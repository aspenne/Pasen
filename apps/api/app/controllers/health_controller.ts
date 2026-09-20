import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'

import { riotKeyProvider } from '#riot/service'

type DependencyState = { ok: true } | { ok: false; error: string }

async function probe(run: () => Promise<unknown>): Promise<DependencyState> {
  try {
    await run()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export default class HealthController {
  /**
   * Reports whether the API can reach the two things it cannot work without.
   * Returns 503 when either is down so a container orchestrator or uptime check
   * sees a failure rather than a cheerful 200.
   */
  async show({ response }: HttpContext) {
    const [database, cache] = await Promise.all([
      probe(() => db.rawQuery('select 1')),
      probe(() => redis.ping()),
    ])

    const healthy = database.ok && cache.ok

    return response.status(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'degraded',
      checks: { database, redis: cache },
    })
  }

  /**
   * Whether new data is still arriving, for the public site to say so.
   *
   * A development key expires every twenty-four hours, and when it does the
   * site keeps serving perfectly good pages that quietly stop growing - the
   * worst failure it has, because nothing on screen distinguishes "nobody
   * played" from "we stopped being able to look".
   *
   * Deliberately says nothing about the key itself: not its fingerprint, not
   * its source, only that Riot is refusing us and since when.
   */
  async status() {
    const key = await riotKeyProvider().status()
    const latest = await db.from('matches').max('game_creation as at').first()

    return {
      ingestion: {
        paused: key.invalidSince !== null || !key.hasKey,
        reason: key.hasKey ? (key.invalidSince ? 'key-rejected' : null) : 'key-missing',
        since: key.invalidSince,
      },
      lastMatchAt: latest?.at ? new Date(latest.at).toISOString() : null,
    }
  }
}
