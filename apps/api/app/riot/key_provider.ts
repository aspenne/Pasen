import { createHash } from 'node:crypto'
import type { RedisLike } from '#riot/redis'

import Setting from '#models/setting'
import { RiotKeyMissingError } from '#riot/errors'

const KEY_SETTING = 'riot.api_key'
const INVALID_SETTING = 'riot.key_invalid_since'
const CACHE_KEY = 'riot:key:cache'
const CACHE_TTL_SECONDS = 300

export type RiotKeyStatus = {
  hasKey: boolean
  source: 'database' | 'env' | 'none'
  /** Set when Riot last rejected the key, so the UI can say "expired". */
  invalidSince: string | null
  /** Short hash of the key. Safe to display and to log; never the key itself. */
  fingerprint: string | null
}

/**
 * Development keys expire every 24 hours, so the key cannot live in the
 * environment: the admin pastes a new one and every process must pick it up
 * without a restart. The database is the source of truth, Redis is the shared
 * cache, and the environment is only a bootstrap fallback for a fresh install.
 */
export class RiotKeyProvider {
  readonly #redis: RedisLike
  readonly #envKey?: string
  /**
   * undefined until the first successful call asks. A process that starts up
   * after another one recorded a rejection has to learn about it somehow, or
   * the "key expired" banner stays on screen for a key that works again.
   */
  #rejected?: boolean

  constructor(options: { connection: RedisLike; envKey?: string }) {
    this.#redis = options.connection
    this.#envKey = options.envKey?.trim() || undefined
  }

  async get(): Promise<string> {
    const key = await this.#resolve()
    if (!key) {
      throw new RiotKeyMissingError()
    }
    return key
  }

  async #resolve(): Promise<string | null> {
    const cached = await this.#redis.get(CACHE_KEY)
    if (cached !== null) {
      // Empty string is a cached "nothing configured", which spares the database
      // a lookup on every call while no key is set.
      return cached || null
    }

    const stored = await Setting.find(KEY_SETTING)
    const key = (stored?.value as string | undefined) ?? this.#envKey ?? ''

    await this.#redis.set(CACHE_KEY, key, 'EX', CACHE_TTL_SECONDS)
    return key || null
  }

  /** Stores a new key and makes it visible to every process at once. */
  async set(key: string): Promise<void> {
    const trimmed = key.trim()
    if (!trimmed) {
      throw new Error('Refusing to store an empty Riot API key')
    }

    await Setting.updateOrCreate({ key: KEY_SETTING }, { value: trimmed })
    await Setting.query().where('key', INVALID_SETTING).delete()
    await this.#redis.set(CACHE_KEY, trimmed, 'EX', CACHE_TTL_SECONDS)
  }

  /**
   * Recorded when Riot answers 401/403. Jobs stop rather than burn through
   * retries, and the public site can show that data has stopped refreshing.
   */
  async markInvalid(now: Date = new Date()): Promise<void> {
    this.#rejected = true
    await Setting.updateOrCreate({ key: INVALID_SETTING }, { value: now.toISOString() })
  }

  /**
   * Clears the flag after a call succeeds again, so a rejection - transient, or
   * from a key that has since been replaced - does not leave a permanent "key
   * expired" banner.
   *
   * The flag is read from the database once per process and cached, so the
   * overwhelming majority of successful calls cost nothing. Reading it lazily
   * rather than trusting an in-process boolean matters: the process that saw
   * the rejection is usually long gone by the time one succeeds again.
   */
  async markValid(): Promise<void> {
    this.#rejected ??= (await Setting.find(INVALID_SETTING)) !== null

    if (!this.#rejected) {
      return
    }

    this.#rejected = false
    await Setting.query().where('key', INVALID_SETTING).delete()
  }

  async fingerprint(): Promise<string | null> {
    const key = await this.#resolve()
    return key ? fingerprintOf(key) : null
  }

  async status(): Promise<RiotKeyStatus> {
    const stored = await Setting.find(KEY_SETTING)
    const invalid = await Setting.find(INVALID_SETTING)
    const key = (stored?.value as string | undefined) ?? this.#envKey

    return {
      hasKey: Boolean(key),
      source: stored ? 'database' : this.#envKey ? 'env' : 'none',
      invalidSince: (invalid?.value as string | undefined) ?? null,
      fingerprint: key ? fingerprintOf(key) : null,
    }
  }
}

/**
 * Also used to namespace the rate limiter: Riot's budget is per key, so a
 * rotation should start from a clean slate rather than inherit old counters.
 */
export function fingerprintOf(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 12)
}
