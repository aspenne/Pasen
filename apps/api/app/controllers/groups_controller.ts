import type { HttpContext } from '@adonisjs/core/http'
import redis from '@adonisjs/redis/services/main'
import vine from '@vinejs/vine'
import { QUEUE_GROUPS } from '@pasen/shared'

import Group from '#models/group'
import RiotAccount from '#models/riot_account'
import { ActivityService } from '#stats/activity_service'
import { DailyFeedService } from '#stats/daily_feed_service'
import { DuoStatsService } from '#stats/duo_stats_service'
import { GroupChampionService } from '#stats/group_champion_service'
import { GroupService } from '#stats/group_service'
import { LeaderboardService } from '#stats/leaderboard_service'
import { LiveGameService } from '#ingestion/live_game_service'
import { riot } from '#riot/service'
import type { RedisLike } from '#riot/redis'

const leaderboardQuery = vine.compile(
  vine.object({ period: vine.enum(['week', 'month', 'all'] as const).optional() })
)

const feedQuery = vine.compile(
  vine.object({
    date: vine.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    queue: vine.enum(QUEUE_GROUPS).optional(),
  })
)

export default class GroupsController {
  async show({ params }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    return new GroupService().overview(group)
  }

  async feed({ params, request }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    const query = await feedQuery.validate(request.qs())

    return new DailyFeedService().forGroup(group, {
      date: query.date,
      queueGroup: query.queue,
    })
  }

  async duos({ params }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    return new DuoStatsService().forGroup(group)
  }

  async leaderboards({ params, request }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    const query = await leaderboardQuery.validate(request.qs())
    return new LeaderboardService().forGroup(group, query.period ?? 'week')
  }

  async champions({ params }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    return new GroupChampionService().forGroup(group)
  }

  async activity({ params }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    return { days: await new ActivityService().forGroup(group) }
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
