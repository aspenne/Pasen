import db from '@adonisjs/lucid/services/db'
import { lpBetween, type QueueGroup } from '@pasen/shared'
import { DateTime } from 'luxon'

import Group from '#models/group'
import { DEFAULT_SCOPE, applyScope, type QueueScope } from '#stats/scope'

export type FeedMember = {
  memberSlug: string
  displayName: string
  accentColor: string | null
  riotId: string
  championId: number
  championName: string
  teamPosition: string | null
  teamId: number
  win: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  visionScore: number
  goldEarned: number
  items: number[]
  /** Raw perk selections; the UI reads the keystone and the secondary tree. */
  perks: unknown
  summonerSpells: [number, number]
  subteamPlacement: number | null
}

export type FeedMatch = {
  matchId: string
  queueId: number
  queueGroup: QueueGroup
  gameMode: string
  gameCreation: string
  gameDuration: number
  /** Ended by the early vote after a leaver: neither a win nor a loss for anyone in it. */
  remake: boolean
  /** Everyone from the group who was in this game, on either side. */
  members: FeedMember[]
}

export type FeedTotals = {
  /** Distinct matches. A five-stack counts once. */
  games: number
  /** Member participations. A five-stack counts five. */
  memberGames: number
  /** Participations in remakes, which count as neither wins nor losses. */
  remakes: number
  wins: number
  losses: number
  /** Over decided participations, not matches: two members on opposite sides is 1-1. */
  winRate: number
  championsPlayed: number
}

export type DailyFeed = {
  date: string
  timezone: string
  totals: FeedTotals
  matches: FeedMatch[]
  /**
   * LP won or lost that day, by member slug, from the recorded standings - so
   * a refunded loss is not counted as one. Only members whose standing moved
   * are listed. Null for a scope without LP: normals, ARAM, Arena, customs.
   */
  lp: Record<string, number> | null
}

const SOLO = 'RANKED_SOLO_5x5'
const FLEX = 'RANKED_FLEX_SR'

/** The ranked queues each scope's LP comes from. */
const LP_QUEUES: Partial<Record<QueueScope, string[]>> = {
  ranked_solo: [SOLO],
  ranked_flex: [FLEX],
  rift: [SOLO, FLEX],
  all: [SOLO, FLEX],
}

/**
 * How late a game's standing can be recorded. The worker reads the rank as
 * soon as it has ingested a game, a few minutes after it ends, so the day's
 * window for LP closes this much after midnight - and opens this much after
 * the previous one, which leaves last night's final game out of today.
 */
const READING_LAG = { minutes: 10 }

export type FeedQuery = {
  /** ISO date in the group's own timezone. Defaults to today there. */
  date?: string
  scope?: QueueScope
}

/**
 * The group's day, which is the site's front page.
 *
 * "Today" is a local question: a group in Paris finishing a game at 01:00 still
 * calls that last night. The window is therefore computed in the group's own
 * timezone and converted to UTC for the query, never the other way round.
 */
export class DailyFeedService {
  async forGroup(group: Group, query: FeedQuery = {}): Promise<DailyFeed> {
    const zone = group.timezone
    const day = query.date ? DateTime.fromISO(query.date, { zone }) : DateTime.now().setZone(zone)

    if (!day.isValid) {
      throw new Error(`Invalid date "${query.date}"`)
    }

    const from = day.startOf('day')
    const to = from.plus({ days: 1 })

    const feed = db
      .from('matches as m')
      .join('match_participants as p', 'p.match_id', 'm.match_id')
      .join('riot_accounts as a', 'a.puuid', 'p.puuid')
      .join('group_members as gm', 'gm.member_id', 'a.member_id')
      .join('members as mem', 'mem.id', 'a.member_id')
      .where('gm.group_id', group.id)
      .andWhere('m.game_creation', '>=', from.toUTC().toSQL()!)
      .andWhere('m.game_creation', '<', to.toUTC().toSQL()!)
      .orderBy('m.game_creation', 'desc')
      .select(
        'm.match_id',
        'm.queue_id',
        'm.queue_group',
        'm.game_mode',
        'm.game_creation',
        'm.game_duration',
        'm.remake',
        'mem.slug as member_slug',
        'mem.display_name',
        'mem.accent_color',
        'a.game_name',
        'a.tag_line',
        'p.champion_id',
        'p.champion_name',
        'p.team_position',
        'p.team_id',
        'p.win',
        'p.kills',
        'p.deaths',
        'p.assists',
        'p.cs',
        'p.vision_score',
        'p.gold_earned',
        'p.items',
        'p.perks',
        'p.summoner1_id',
        'p.summoner2_id',
        'p.subteam_placement'
      )

    applyScope(feed, query.scope ?? DEFAULT_SCOPE)
    const rows = await feed

    const matches = new Map<string, FeedMatch>()
    const champions = new Set<number>()
    let wins = 0
    let memberGames = 0
    let remakes = 0

    for (const row of rows) {
      let match = matches.get(row.match_id)

      if (!match) {
        match = {
          matchId: row.match_id,
          queueId: row.queue_id,
          queueGroup: row.queue_group,
          gameMode: row.game_mode,
          gameCreation: DateTime.fromJSDate(new Date(row.game_creation)).toUTC().toISO()!,
          gameDuration: row.game_duration,
          remake: row.remake,
          members: [],
        }
        matches.set(row.match_id, match)
      }

      match.members.push({
        memberSlug: row.member_slug,
        displayName: row.display_name,
        accentColor: row.accent_color,
        riotId: `${row.game_name}#${row.tag_line}`,
        championId: row.champion_id,
        championName: row.champion_name,
        teamPosition: row.team_position,
        teamId: row.team_id,
        win: row.win,
        kills: row.kills,
        deaths: row.deaths,
        assists: row.assists,
        cs: row.cs,
        visionScore: row.vision_score,
        goldEarned: row.gold_earned,
        items: row.items,
        perks: row.perks ?? null,
        summonerSpells: [row.summoner1_id, row.summoner2_id],
        subteamPlacement: row.subteam_placement,
      })

      champions.add(row.champion_id)
      memberGames++
      if (row.remake) remakes++
      else if (row.win) wins++
    }
    const decided = memberGames - remakes

    return {
      date: from.toISODate()!,
      timezone: zone,
      totals: {
        games: matches.size,
        memberGames,
        remakes,
        wins,
        losses: memberGames - remakes - wins,
        winRate: decided === 0 ? 0 : Math.round((wins / decided) * 1000) / 10,
        championsPlayed: champions.size,
      },
      matches: [...matches.values()],
      lp: await this.#lp(
        group,
        query.scope ?? DEFAULT_SCOPE,
        from.plus(READING_LAG),
        to.plus(READING_LAG)
      ),
    }
  }

  async #lp(
    group: Group,
    scope: QueueScope,
    from: DateTime,
    to: DateTime
  ): Promise<Record<string, number> | null> {
    const queues = LP_QUEUES[scope]
    if (!queues) return null

    const accounts = await db
      .from('riot_accounts as a')
      .join('group_members as gm', 'gm.member_id', 'a.member_id')
      .join('members as mem', 'mem.id', 'a.member_id')
      .where('gm.group_id', group.id)
      .select('a.id', 'mem.slug')
    if (accounts.length === 0) return {}

    const ids = accounts.map((account: { id: number }) => account.id)
    const columns = [
      'riot_account_id',
      'queue_type',
      'captured_at',
      'tier',
      'rank',
      'league_points',
    ]
    const [inside, before] = await Promise.all([
      db
        .from('league_entries')
        .whereIn('riot_account_id', ids)
        .whereIn('queue_type', queues)
        .where('captured_at', '>', from.toUTC().toSQL()!)
        .andWhere('captured_at', '<=', to.toUTC().toSQL()!)
        .select(columns),
      // Only the last standing before the day matters, however long ago it was.
      db
        .from('league_entries')
        .distinctOn('riot_account_id', 'queue_type')
        .whereIn('riot_account_id', ids)
        .whereIn('queue_type', queues)
        .where('captured_at', '<=', from.toUTC().toSQL()!)
        .orderBy([
          { column: 'riot_account_id' },
          { column: 'queue_type' },
          { column: 'captured_at', order: 'desc' },
        ])
        .select(columns),
    ])

    const gained = lpBetween(
      [...before, ...inside].map((row) => ({
        accountId: row.riot_account_id,
        queueType: row.queue_type,
        capturedAt: new Date(row.captured_at),
        tier: row.tier,
        rank: row.rank,
        leaguePoints: row.league_points,
      })),
      from.toJSDate(),
      to.toJSDate()
    )

    // Members with several accounts get one total.
    const bySlug: Record<string, number> = {}
    for (const account of accounts as { id: number; slug: string }[]) {
      const lp = gained.get(account.id)
      if (lp !== undefined) bySlug[account.slug] = (bySlug[account.slug] ?? 0) + lp
    }
    return bySlug
  }
}
