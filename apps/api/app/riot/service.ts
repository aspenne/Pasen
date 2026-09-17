import logger from '@adonisjs/core/services/logger'
import redis from '@adonisjs/redis/services/main'

import env from '#start/env'
import { RiotClient } from '#riot/client'
import { RiotGateway } from '#riot/gateway'
import { RiotKeyProvider } from '#riot/key_provider'
import type { RedisLike } from '#riot/redis'

let cached: { client: RiotClient; keyProvider: RiotKeyProvider; gateway: RiotGateway } | undefined

/**
 * Built once per process. The HTTP server and the worker each get their own
 * instance, but they share the rate-limit budget and the key cache through
 * Redis, which is the only state that has to be common.
 */
function build() {
  const connection = redis.connection() as unknown as RedisLike

  const keyProvider = new RiotKeyProvider({
    connection,
    envKey: env.get('RIOT_API_KEY'),
  })

  const gateway = new RiotGateway({
    keyProvider,
    connection,
    windows: [
      { limit: env.get('RIOT_RATE_PER_SECOND'), seconds: 1 },
      { limit: env.get('RIOT_RATE_PER_TWO_MINUTES'), seconds: 120 },
    ],
    logger,
  })

  return { client: new RiotClient(gateway), keyProvider, gateway }
}

export function riot(): RiotClient {
  cached ??= build()
  return cached.client
}

export function riotKeyProvider(): RiotKeyProvider {
  cached ??= build()
  return cached.keyProvider
}

/**
 * The gateway itself, for the admin screen's budget read-out. Services take the
 * narrower RiotClient so they cannot bypass the typed endpoints.
 */
export function riotGateway(): RiotGateway {
  cached ??= build()
  return cached.gateway
}
