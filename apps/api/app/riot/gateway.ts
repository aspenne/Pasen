import type { RedisLike } from '#riot/redis'
import type { Logger } from '@adonisjs/core/logger'

import { RiotKeyProvider, fingerprintOf } from '#riot/key_provider'
import { RiotRateLimiter, type RateWindow } from '#riot/rate_limiter'
import { hostnameFor, type RiotHost } from '#riot/routing'
import {
  RiotApiError,
  RiotKeyRejectedError,
  RiotNotFoundError,
  RiotRateLimitedError,
  RiotUnavailableError,
} from '#riot/errors'

export type RiotRequest = {
  host: RiotHost
  path: string
  search?: Record<string, string | number | boolean | undefined>
  /** Identifies the Riot method, for logging and future per-method limits. */
  endpoint: string
  /**
   * 'background' work leaves part of the budget untouched so live polling is
   * never left waiting for the next window. Defaults to 'interactive'.
   */
  priority?: 'interactive' | 'background'
  /** How long this call may wait for rate-limit capacity before failing. */
  maxWaitMs?: number
  signal?: AbortSignal
}

/**
 * What the endpoint wrappers depend on. Narrower than the gateway itself so a
 * test can hand them a stub without standing up Redis and a key provider.
 */
export interface RiotRequester {
  request<T>(request: RiotRequest): Promise<T>
}

export type RiotGatewayOptions = {
  keyProvider: RiotKeyProvider
  connection: RedisLike
  windows: RateWindow[]
  /** Namespaces the limiter. The key fingerprint is appended to it. */
  prefix?: string
  logger?: Logger
  fetch?: typeof fetch
  /**
   * One clock for the whole Riot stack: the backoff here and the rate limiter's
   * waits must move together, or a test that stubs one still blocks on the other.
   */
  now?: () => number
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
}

/** Enough attempts to ride out a blip, few enough to never look like a loop. */
const MAX_ATTEMPTS = 3

/**
 * A fifth of every window is kept for interactive work. Measured, not guessed:
 * with a backfill running flat out the live poll was landing twice every two
 * minutes instead of once a minute, because it could only get tokens when the
 * window rolled over.
 */
const BACKGROUND_RESERVE = 0.2

/**
 * The only thing in the application that talks to Riot. Everything funnels
 * through here so the rate-limit budget, the key rotation and the retry policy
 * exist in exactly one place; a service that called fetch directly would spend
 * budget nobody accounted for and take the whole key down with it.
 */
export class RiotGateway implements RiotRequester {
  readonly #keyProvider: RiotKeyProvider
  readonly #connection: RedisLike
  readonly #windows: RateWindow[]
  readonly #prefix: string
  readonly #logger?: Logger
  readonly #fetch: typeof fetch
  readonly #now: () => number
  readonly #sleep: (ms: number, signal?: AbortSignal) => Promise<void>

  #cachedLimiter?: { fingerprint: string; limiter: RiotRateLimiter }

  constructor(options: RiotGatewayOptions) {
    this.#keyProvider = options.keyProvider
    this.#connection = options.connection
    this.#windows = options.windows
    this.#prefix = options.prefix ?? 'riot:rl'
    this.#logger = options.logger
    this.#fetch = options.fetch ?? globalThis.fetch
    this.#now = options.now ?? Date.now
    this.#sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  }

  /**
   * The limiter is namespaced by key fingerprint: Riot's budget is per key, so a
   * rotation deserves fresh counters rather than inheriting a penalty earned by
   * the key it replaced.
   */
  async limiter(): Promise<RiotRateLimiter> {
    const key = await this.#keyProvider.get()
    const fingerprint = fingerprintOf(key)

    if (this.#cachedLimiter?.fingerprint !== fingerprint) {
      this.#cachedLimiter = {
        fingerprint,
        limiter: new RiotRateLimiter({
          connection: this.#connection,
          windows: this.#windows,
          prefix: `${this.#prefix}:${fingerprint}`,
          now: this.#now,
          sleep: this.#sleep,
        }),
      }
    }

    return this.#cachedLimiter.limiter
  }

  async request<T>(request: RiotRequest): Promise<T> {
    let lastError: RiotApiError | undefined

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const key = await this.#keyProvider.get()
      const limiter = await this.limiter()

      await limiter.acquire({
        maxWaitMs: request.maxWaitMs,
        signal: request.signal,
        reserve: request.priority === 'background' ? BACKGROUND_RESERVE : 0,
      })

      const url = this.#urlFor(request)
      const response = await this.#fetch(url, {
        method: 'GET',
        headers: { 'X-Riot-Token': key, 'Accept': 'application/json' },
        signal: request.signal,
      })

      if (response.ok) {
        await this.#keyProvider.markValid()
        return (await response.json()) as T
      }

      const error = await this.#classify(response, request)

      // A dead key, a missing resource or a malformed request all fail the same
      // way on a retry, so they surface immediately.
      if (!isRetryable(error)) {
        throw error
      }

      if (error instanceof RiotRateLimitedError) {
        // Riot's own Retry-After beats our counters: hold every process back,
        // not just this call.
        await limiter.penalize(error.retryAfterMs)
        this.#logger?.warn(
          { endpoint: request.endpoint, retryAfterMs: error.retryAfterMs, attempt },
          'riot rate limited'
        )
      } else {
        this.#logger?.warn(
          { endpoint: request.endpoint, status: error.status, attempt },
          'riot unavailable, backing off'
        )
        await this.#sleep(backoffMs(attempt))
      }

      lastError = error
    }

    throw lastError!
  }

  #urlFor(request: RiotRequest): string {
    const url = new URL(request.path, `https://${hostnameFor(request.host)}`)

    for (const [name, value] of Object.entries(request.search ?? {})) {
      // `undefined` means "omit"; without this the URL would carry the literal
      // string "undefined" and Riot would answer 400.
      if (value !== undefined) {
        url.searchParams.append(name, String(value))
      }
    }

    return url.toString()
  }

  /**
   * Riot explains every refusal in the body, and the status alone rarely says
   * enough: a 401 cannot separate an expired key from a suspended account, and
   * a 400 says nothing at all about which argument it disliked. Read once, for
   * whatever error this turns out to be.
   */
  async #detailOf(response: Response): Promise<string | null> {
    try {
      return (await response.text()).slice(0, 200) || null
    } catch {
      return null
    }
  }

  async #classify(response: Response, request: RiotRequest): Promise<RiotApiError> {
    if (response.status === 404) {
      return new RiotNotFoundError(request.endpoint)
    }

    if (response.status === 401 || response.status === 403) {
      // Development keys expire daily; record it so the admin sees why the site
      // stopped refreshing instead of guessing.
      await this.#keyProvider.markInvalid()
      return new RiotKeyRejectedError(
        response.status,
        request.endpoint,
        await this.#detailOf(response)
      )
    }

    if (response.status === 429) {
      return new RiotRateLimitedError(request.endpoint, retryAfterMsOf(response))
    }

    if (response.status >= 500) {
      return new RiotUnavailableError(response.status, request.endpoint)
    }

    const detail = await this.#detailOf(response)
    return new RiotApiError(
      response.status,
      request.endpoint,
      `Riot returned ${response.status} for ${request.endpoint}${detail ? `: ${detail}` : ''}`
    )
  }
}

function isRetryable(error: RiotApiError): boolean {
  return error instanceof RiotRateLimitedError || error instanceof RiotUnavailableError
}

function backoffMs(attempt: number): number {
  // 500ms, 1s, 2s — plus jitter so a burst of failing jobs does not retry in
  // lockstep and recreate the spike that knocked them over.
  return 2 ** (attempt - 1) * 500 + Math.floor(Math.random() * 250)
}

function retryAfterMsOf(response: Response): number {
  const header = response.headers.get('retry-after')
  const seconds = header ? Number(header) : Number.NaN

  // Riot always sends Retry-After on a 429, but a proxy in between might not.
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 1000
}
