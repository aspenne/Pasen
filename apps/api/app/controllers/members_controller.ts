import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { QUEUE_SCOPES } from '@pasen/shared'

import redis from '@adonisjs/redis/services/main'

import Member from '#models/member'
import { LadderService } from '#stats/ladder_service'
import { riot } from '#riot/service'
import type { RedisLike } from '#riot/redis'
import { PlayerStatsService } from '#stats/player_stats_service'
import { parseScope } from '#stats/scope'

const historyQuery = vine.compile(
  vine.object({
    cursor: vine.string().optional(),
    limit: vine.number().min(1).max(100).optional(),
    scope: vine.enum(QUEUE_SCOPES).optional(),
  })
)

const poolQuery = vine.compile(
  vine.object({ scope: vine.enum(QUEUE_SCOPES).optional() })
)

const lpQuery = vine.compile(vine.object({ queueType: vine.string().optional() }))

export default class MembersController {
  async show({ params }: HttpContext) {
    const member = await Member.query()
      .where('slug', params.slug)
      .preload('riotAccounts')
      .firstOrFail()

    return {
      slug: member.slug,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
      accentColor: member.accentColor,
      accounts: member.riotAccounts.map((account) => ({
        riotId: account.riotId,
        platform: account.platform,
        profileIconId: account.profileIconId,
        summonerLevel: account.summonerLevel,
        backfillState: account.backfillState,
        syncedFrom: account.syncedFrom?.toUTC().toISO() ?? null,
        lastSyncedAt: account.lastSyncedAt?.toUTC().toISO() ?? null,
      })),
    }
  }

  async matches({ params, request }: HttpContext) {
    const member = await Member.findByOrFail('slug', params.slug)
    const query = await historyQuery.validate(request.qs())

    return new PlayerStatsService().matches(member, {
      cursor: query.cursor,
      limit: query.limit,
      scope: parseScope(query.scope),
    })
  }

  async champions({ params, request }: HttpContext) {
    const member = await Member.findByOrFail('slug', params.slug)
    const query = await poolQuery.validate(request.qs())

    return new PlayerStatsService().championPool(member, { scope: parseScope(query.scope) })
  }

  /**
   * Where this member sits on the region's apex ladder. Null below Master,
   * where Riot publishes no order to sit in.
   */
  async ladder({ params }: HttpContext) {
    const member = await Member.query()
      .where('slug', params.slug)
      .preload('riotAccounts')
      .firstOrFail()

    const service = new LadderService(riot(), redis as unknown as RedisLike)

    // A member's smurfs can each be ranked; the best placing is the one to show.
    let best: Awaited<ReturnType<LadderService['positionFor']>> = null
    for (const account of member.riotAccounts) {
      const found = await service.positionFor(account.puuid, account.platform)
      if (found && (best === null || found.position < best.position)) best = found
    }

    return best ?? { position: null }
  }

  async lpHistory({ params, request }: HttpContext) {
    const member = await Member.findByOrFail('slug', params.slug)
    const query = await lpQuery.validate(request.qs())

    return { points: await new PlayerStatsService().lpHistory(member, query.queueType) }
  }
}
