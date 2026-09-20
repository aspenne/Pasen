/**
 * Riot's failure modes mean very different things to a caller, so each one gets
 * a type. A 404 on spectator means "not in a game" and is routine; a 403 means
 * the key died and every job should stop rather than hammer the API.
 */
export class RiotApiError extends Error {
  readonly status: number
  readonly endpoint: string

  constructor(status: number, endpoint: string, message: string) {
    super(message)
    this.name = 'RiotApiError'
    this.status = status
    this.endpoint = endpoint
  }
}

/** The resource does not exist. On spectator-v5 this is the normal "not in game". */
export class RiotNotFoundError extends RiotApiError {
  constructor(endpoint: string) {
    super(404, endpoint, `Riot returned 404 for ${endpoint}`)
    this.name = 'RiotNotFoundError'
  }
}

/**
 * The key is missing, expired or not entitled. Development keys hit this daily.
 *
 * Carries Riot's own explanation, because the status alone cannot tell an
 * expired key from a suspended account from a key that was never valid - and
 * guessing between those costs an evening.
 */
export class RiotKeyRejectedError extends RiotApiError {
  readonly detail: string | null

  constructor(status: number, endpoint: string, detail: string | null = null) {
    super(
      status,
      endpoint,
      `Riot rejected the API key (${status}) on ${endpoint}${detail ? `: ${detail}` : ''}`
    )
    this.name = 'RiotKeyRejectedError'
    this.detail = detail
  }
}

/** Rate limited. `retryAfterMs` comes from Riot's Retry-After header. */
export class RiotRateLimitedError extends RiotApiError {
  readonly retryAfterMs: number

  constructor(endpoint: string, retryAfterMs: number) {
    super(429, endpoint, `Riot rate limited ${endpoint}, retry in ${retryAfterMs}ms`)
    this.name = 'RiotRateLimitedError'
    this.retryAfterMs = retryAfterMs
  }
}

/** Riot is down or a shard is unhealthy. Worth retrying with backoff. */
export class RiotUnavailableError extends RiotApiError {
  constructor(status: number, endpoint: string) {
    super(status, endpoint, `Riot is unavailable (${status}) on ${endpoint}`)
    this.name = 'RiotUnavailableError'
  }
}

/** No key configured at all — nothing can be fetched until the admin sets one. */
export class RiotKeyMissingError extends Error {
  constructor() {
    super('No Riot API key configured. Set one from /admin or via RIOT_API_KEY.')
    this.name = 'RiotKeyMissingError'
  }
}
