import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import type { QueueGroup } from '@pasen/shared'
import { DateTime } from 'luxon'

import Member from '#models/member'

export type ChampionPoolEntry = {
  championId: number
  championName: string
  games: number
  wins: number
  winRate: number
  kda: number
  averageCs: number
  lastPlayedAt: string
}

export type ChampionPool = {
  /** Champions played at least once, out of every champion in the game. */
  played: number
  available: number
  entries: ChampionPoolEntry[]
}

export type MatchHistoryEntry = {
  matchId: string
  queueGroup: QueueGroup
  queueId: number
  gameMode: string
  gameCreation: string
  gameDuration: number
  riotId: string
  championId: number
  championName: string
  teamPosition: string | null
  win: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  visionScore: number
  items: number[]
  subteamPlacement: number | null
}

export type MatchHistory = {
  entries: MatchHistoryEntry[]
  /** Opaque cursor for the next page, or null at the end of history. */
  nextCursor: string | null
}

export type LpPoint = {
  capturedAt: string
  tier: string | null
  rank: string | null
  leaguePoints: number
  wins: number
  losses: number
}

export type StatsFilter = { queueGroup?: QueueGroup }

/**
 * Everything on a member's own page. Every query spans all of that member's
 * accounts, because a person with a smurf is still one person.
 */
export class PlayerStatsService {
  /**
   * Champion pool, which is the stat the group actually argues about: how many
   * of the roster you have touched, and which ones you keep going back to.
   */
  async championPool(member: Member, filter: StatsFilter = {}): Promise<ChampionPool> {
    const rows = await db
      .from('match_participants as p')
      .join('matches as m', 'm.match_id', 'p.match_id')
      .join('riot_accounts as a', 'a.puuid', 'p.puuid')
      .where('a.member_id', member.id)
      .andWhere('m.stats_eligible', true)
      .if(filter.queueGroup, (q) => q.andWhere('m.queue_group', filter.queueGroup!))
      .groupBy('p.champion_id', 'p.champion_name')
      .select('p.champion_id', 'p.champion_name')
      .count('* as games')
      .sum({ wins: db.raw('case when p.win then 1 else 0 end') })
      .sum({ kills: 'p.kills' })
      .sum({ deaths: 'p.deaths' })
      .sum({ assists: 'p.assists' })
      .avg({ avg_cs: 'p.cs' })
      .max({ last_played: 'm.game_creation' })
      .orderBy('games', 'desc')

    // The denominator comes from the synced champion list, never a constant:
    // Riot adds champions, and 173 today was 170 a year ago.
    const [{ count }] = await db.from('static_champions').count('* as count')

    return {
      played: rows.length,
      available: Number(count),
      entries: rows.map((row: any) => {
        const games = Number(row.games)
        const wins = Number(row.wins)
        const deaths = Number(row.deaths)
        return {
          championId: row.champion_id,
          championName: row.champion_name,
          games,
          wins,
          winRate: Math.round((wins / games) * 1000) / 10,
          // A deathless run is a perfect KDA, not a division by zero.
          kda:
            Math.round(((Number(row.kills) + Number(row.assists)) / Math.max(deaths, 1)) * 100) /
            100,
          averageCs: Math.round(Number(row.avg_cs)),
          lastPlayedAt: DateTime.fromJSDate(new Date(row.last_played)).toUTC().toISO()!,
        }
      }),
    }
  }

  /**
   * Paginated history, newest first. The cursor is the last row's timestamp and
   * match id rather than an offset: new games arrive while someone is scrolling,
   * and an offset would quietly skip a match on every page turn.
   */
  async matches(
    member: Member,
    options: { cursor?: string; limit?: number } & StatsFilter = {}
  ): Promise<MatchHistory> {
    const limit = Math.min(options.limit ?? 20, 100)
    const cursor = decodeCursor(options.cursor)

    const rows = await db
      .from('match_participants as p')
      .join('matches as m', 'm.match_id', 'p.match_id')
      .join('riot_accounts as a', 'a.puuid', 'p.puuid')
      .where('a.member_id', member.id)
      .if(filterGiven(options), (q) => q.andWhere('m.queue_group', options.queueGroup!))
      .if(cursor, (q) =>
        q.andWhereRaw('(m.game_creation, m.match_id) < (?, ?)', [cursor!.at, cursor!.matchId])
      )
      .orderBy([
        { column: 'm.game_creation', order: 'desc' },
        { column: 'm.match_id', order: 'desc' },
      ])
      .limit(limit + 1)
      .select(
        'm.match_id',
        'm.queue_group',
        'm.queue_id',
        'm.game_mode',
        'm.game_creation',
        'm.game_duration',
        'a.game_name',
        'a.tag_line',
        'p.champion_id',
        'p.champion_name',
        'p.team_position',
        'p.win',
        'p.kills',
        'p.deaths',
        'p.assists',
        'p.cs',
        'p.vision_score',
        'p.items',
        'p.subteam_placement'
      )

    const page = rows.slice(0, limit)
    const last = page.at(-1)

    return {
      entries: page.map((row: any) => ({
        matchId: row.match_id,
        queueGroup: row.queue_group,
        queueId: row.queue_id,
        gameMode: row.game_mode,
        gameCreation: DateTime.fromJSDate(new Date(row.game_creation)).toUTC().toISO()!,
        gameDuration: row.game_duration,
        riotId: `${row.game_name}#${row.tag_line}`,
        championId: row.champion_id,
        championName: row.champion_name,
        teamPosition: row.team_position,
        win: row.win,
        kills: row.kills,
        deaths: row.deaths,
        assists: row.assists,
        cs: row.cs,
        visionScore: row.vision_score,
        items: row.items,
        subteamPlacement: row.subteam_placement,
      })),
      nextCursor:
        rows.length > limit && last
          ? encodeCursor(new Date(last.game_creation), last.match_id)
          : null,
    }
  }

  /** Rank over time, per account, for the LP curve. */
  async lpHistory(member: Member, queueType = 'RANKED_SOLO_5x5'): Promise<LpPoint[]> {
    const rows = await db
      .from('league_entries as e')
      .join('riot_accounts as a', 'a.id', 'e.riot_account_id')
      .where('a.member_id', member.id)
      .andWhere('e.queue_type', queueType)
      .orderBy('e.captured_at', 'asc')
      .select('e.captured_at', 'e.tier', 'e.rank', 'e.league_points', 'e.wins', 'e.losses')

    return rows.map((row: any) => ({
      capturedAt: DateTime.fromJSDate(new Date(row.captured_at)).toUTC().toISO()!,
      tier: row.tier,
      rank: row.rank,
      leaguePoints: row.league_points,
      wins: row.wins,
      losses: row.losses,
    }))
  }
}

function filterGiven(options: StatsFilter): boolean {
  return options.queueGroup !== undefined
}

function encodeCursor(at: Date, matchId: string): string {
  return Buffer.from(`${at.toISOString()}|${matchId}`).toString('base64url')
}

function decodeCursor(cursor?: string): { at: string; matchId: string } | undefined {
  if (!cursor) {
    return undefined
  }

  const [at, matchId] = Buffer.from(cursor, 'base64url').toString('utf8').split('|')
  if (!at || !matchId || Number.isNaN(Date.parse(at))) {
    // A bad cursor is the caller's mistake. Answering 400 says so; silently
    // falling back to the first page would look like an infinite history.
    throw new Exception('Malformed cursor', { status: 400, code: 'E_BAD_CURSOR' })
  }

  return { at, matchId }
}
