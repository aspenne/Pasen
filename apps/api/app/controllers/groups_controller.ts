import type { HttpContext } from '@adonisjs/core/http'
import redis from '@adonisjs/redis/services/main'
import vine from '@vinejs/vine'
import { QUEUE_SCOPES } from '@pasen/shared'

import Group from '#models/group'
import RiotAccount from '#models/riot_account'
import { ActivityService } from '#stats/activity_service'
import { DailyFeedService } from '#stats/daily_feed_service'
import { DuoStatsService } from '#stats/duo_stats_service'
import { GroupChampionService } from '#stats/group_champion_service'
import { GroupService } from '#stats/group_service'
import { LeaderboardService } from '#stats/leaderboard_service'
import { parseScope } from '#stats/scope'
import { LiveGameService } from '#ingestion/live_game_service'
import { riot } from '#riot/service'
import type { RedisLike } from '#riot/redis'

/**
 * Every read takes the same `scope`. Omitted, it is Summoner's Rift rather than
 * every queue: Arena is a different game and averaging it in produces a number
 * that describes neither.
 */
const scopeField = vine.enum(QUEUE_SCOPES).optional()

const leaderboardQuery = vine.compile(
  vine.object({
    period: vine.enum(['week', 'month', 'all'] as const).optional(),
    scope: scopeField,
  })
)

const scopeQuery = vine.compile(vine.object({ scope: scopeField }))

const feedQuery = vine.compile(
  vine.object({
    date: vine.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    scope: scopeField,
  })
)

export default class GroupsController {
  async show({ params, request }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    const { scope } = await scopeQuery.validate(request.qs())
    return new GroupService().overview(group, parseScope(scope))
  }

  async feed({ params, request }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    const query = await feedQuery.validate(request.qs())

    return new DailyFeedService().forGroup(group, {
      date: query.date,
      scope: parseScope(query.scope),
    })
  }

  async duos({ params, request }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    const { scope } = await scopeQuery.validate(request.qs())
    return new DuoStatsService().forGroup(group, 3, parseScope(scope))
  }

  async leaderboards({ params, request }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    const query = await leaderboardQuery.validate(request.qs())
    return new LeaderboardService().forGroup(group, query.period ?? 'week', parseScope(query.scope))
  }

  async champions({ params, request }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    const { scope } = await scopeQuery.validate(request.qs())
    return new GroupChampionService().forGroup(group, parseScope(scope))
  }

  async activity({ params, request }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    const { scope } = await scopeQuery.validate(request.qs())
    return { days: await new ActivityService().forGroup(group, 365, parseScope(scope)) }
  }

  /**
   * Reads the worker's cache, never Riot. A hundred people opening the page
   * during a game costs zero API budget and cannot outrun the rate limit.
   */
  async live({ params }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)

    const service = new LiveGameService(riot(), redis.connection() as unknown as RedisLike)
    const games = await service.current()

    // The cache is global; a request for one group must not leak another's.
    const accounts = await RiotAccount.query()
      .join('group_members as gm', 'gm.member_id', 'riot_accounts.member_id')
      .where('gm.group_id', group.id)
      .preload('member')
      .select('riot_accounts.*')

    const byPuuid = new Map(accounts.map((account) => [account.puuid, account]))

    return {
      games: games
        .filter((game) => game.participants.some((p) => byPuuid.has(p.puuid)))
        .map((game) => ({
          ...game,
          participants: game.participants.map((participant) => {
            const account = byPuuid.get(participant.puuid)
            return {
              ...participant,
              tracked: Boolean(account),
              memberSlug: account?.member.slug ?? null,
              displayName: account?.member.displayName ?? null,
            }
          }),
        })),
    }
  }
}
