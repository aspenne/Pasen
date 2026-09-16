import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),

  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory'] as const),

  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.string.optional(),
  /**
   * Redis database index. Tests use a different one from the application: a test
   * that writes a cache key is not rolled back the way a database transaction
   * is, so sharing an index lets a fake value from the suite leak into the
   * running app until its TTL expires.
   */
  REDIS_DB: Env.schema.number(),

  /*
  |----------------------------------------------------------
  | Pasen
  |----------------------------------------------------------
  */

  /** Browser origin allowed to call this API (CORS + session cookie). */
  WEB_ORIGIN: Env.schema.string(),

  /**
   * Fallback Riot key. The database `settings` table is the source of truth so
   * the daily development key can be rotated from /admin without a redeploy;
   * this is only used to bootstrap a fresh install.
   */
  RIOT_API_KEY: Env.schema.string.optional(),

  /**
   * Published limits for a development/personal key. Keep a safety margin below
   * the real numbers: going over gets the key rate-limited, not queued.
   */
  RIOT_RATE_PER_SECOND: Env.schema.number(),
  RIOT_RATE_PER_TWO_MINUTES: Env.schema.number(),

  /** Match timelines double the API cost per match. Off until phase 5+. */
  RIOT_FETCH_TIMELINES: Env.schema.boolean(),
})
