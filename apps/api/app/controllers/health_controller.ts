import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'

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
}
