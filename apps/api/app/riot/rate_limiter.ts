import type { RedisLike } from '#riot/redis'

export type RateWindow = {
  /** Requests allowed inside the window. */
  limit: number
  /** Window length in seconds. */
  seconds: number
}

export type RateLimiterOptions = {
  connection: RedisLike
  windows: RateWindow[]
  /** Namespaces the counters. One prefix per API key, so keys never share a budget. */
  prefix: string
  /** Injectable clock. Tests drive a virtual one so waits cost no wall time. */
  now?: () => number
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
}

export class RateLimitTimeoutError extends Error {
  constructor(waitMs: number, budgetMs: number) {
    super(`Rate limit wait of ${waitMs}ms exceeds the ${budgetMs}ms budget`)
    this.name = 'RateLimitTimeoutError'
  }
}

/**
 * Riot enforces several windows at once (20/s *and* 100/2min on a development
 * key) against the whole application, not per connection. The HTTP server and
 * the worker therefore cannot each keep their own counters: the budget lives in
 * Redis, and this script is the only thing allowed to spend it.
 *
 * Windows are fixed and aligned to the epoch, mirroring how Riot counts, rather
 * than a sliding window that would let a burst straddle two of Riot's windows.
 */
export class RiotRateLimiter {
  readonly #redis: RedisLike
  readonly #windows: RateWindow[]
  readonly #prefix: string
  readonly #now: () => number
  readonly #sleep: (ms: number, signal?: AbortSignal) => Promise<void>

  /**
   * Checking then incrementing from the client would race between processes, so
   * the whole decision happens inside one Lua call. Either every window has room
   * and all of them are charged, or none is touched and the caller is told how
   * long to wait.
   */
  static readonly #SCRIPT = `
    local now = tonumber(ARGV[1])
    local count = tonumber(ARGV[2])

    local penaltyUntil = tonumber(redis.call('GET', KEYS[1]) or '0')
    if penaltyUntil > now then
      return penaltyUntil - now
    end

    -- Fraction of every window that low-priority callers may not touch, so
    -- background work can never spend the last of the budget that live polling
    -- needs to stay live.
    local reserve = tonumber(ARGV[3 + count * 2])

    local waits = {}
    for i = 1, count do
      local limit = tonumber(ARGV[2 + i])
      local windowEnd = tonumber(ARGV[2 + count + i])
      local used = tonumber(redis.call('GET', KEYS[1 + i]) or '0')
      local usable = limit - math.ceil(limit * reserve)
      if used >= usable then
        return windowEnd - now
      end
      waits[i] = windowEnd - now
    end

    for i = 1, count do
      redis.call('INCR', KEYS[1 + i])
      redis.call('PEXPIRE', KEYS[1 + i], waits[i])
    end

    return 0
  `

  constructor(options: RateLimiterOptions) {
    if (options.windows.length === 0) {
      throw new Error('RiotRateLimiter needs at least one window')
    }

    this.#redis = options.connection
    this.#windows = options.windows
    this.#prefix = options.prefix
    this.#now = options.now ?? Date.now
    this.#sleep = options.sleep ?? sleep
  }

  #penaltyKey() {
    return `${this.#prefix}:penalty`
  }

  #windowKey(window: RateWindow, now: number) {
    const windowMs = window.seconds * 1000
    return `${this.#prefix}:w${window.seconds}:${Math.floor(now / windowMs)}`
  }

  #windowEnd(window: RateWindow, now: number) {
    const windowMs = window.seconds * 1000
    return (Math.floor(now / windowMs) + 1) * windowMs
  }

  /**
   * Returns 0 when the request may go out, otherwise the milliseconds to wait
   * before asking again. Never throws on contention — refusal is a normal result.
   *
   * `reserve` is the fraction of each window the caller agrees to leave alone.
   * Background work passes a non-zero value so it cannot drain the budget that
   * live polling needs; interactive work passes 0 and may use all of it.
   */
  async tryAcquire(now: number = this.#now(), reserve = 0): Promise<number> {
    const keys = [this.#penaltyKey(), ...this.#windows.map((w) => this.#windowKey(w, now))]
    const args = [
      String(now),
      String(this.#windows.length),
      ...this.#windows.map((w) => String(w.limit)),
      ...this.#windows.map((w) => String(this.#windowEnd(w, now))),
      String(reserve),
    ]

    const wait = await this.#redis.eval(RiotRateLimiter.#SCRIPT, keys.length, ...keys, ...args)
    return Number(wait)
  }

  /**
   * Waits until the request may go out. `maxWaitMs` exists so a job can fail
   * fast and be requeued instead of pinning a worker slot for minutes.
   */
  async acquire(
    options: { maxWaitMs?: number; signal?: AbortSignal; reserve?: number } = {}
  ): Promise<void> {
    const budget = options.maxWaitMs ?? Number.POSITIVE_INFINITY

    for (;;) {
      options.signal?.throwIfAborted()

      const wait = await this.tryAcquire(this.#now(), options.reserve ?? 0)
      if (wait === 0) {
        return
      }

      if (wait > budget) {
        throw new RateLimitTimeoutError(wait, budget)
      }

      // A few extra milliseconds so we land inside the next window, not on its
      // boundary, where clock skew against Redis could deny us again.
      await this.#sleep(wait + 5, options.signal)
    }
  }

  /**
   * Called after a 429. Riot's `Retry-After` is authoritative: until it passes,
   * nothing may go out, whatever our own counters believe.
   */
  async penalize(durationMs: number, now: number = this.#now()): Promise<void> {
    const until = now + durationMs
    await this.#redis.set(this.#penaltyKey(), String(until), 'PX', durationMs)
  }

  /** Current usage per window, for the admin sync screen. */
  async snapshot(now: number = this.#now()): Promise<{ window: RateWindow; used: number }[]> {
    const keys = this.#windows.map((w) => this.#windowKey(w, now))
    const values = await this.#redis.mget(keys)

    return this.#windows.map((window, index) => ({
      window,
      used: Number(values[index] ?? 0),
    }))
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    const onAbort = () => {
      clearTimeout(timer)
      reject(signal!.reason)
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
