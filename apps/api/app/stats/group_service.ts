import db from '@adonisjs/lucid/services/db'

import Group from '#models/group'
import { DEFAULT_SCOPE, applyScope, type QueueScope } from '#stats/scope'

export type MemberRank = {
  queueType: string
  tier: string | null
  rank: string | null
  leaguePoints: number
  wins: number
  losses: number
}

export type MemberAccount = {
  riotId: string
  platform: string
  profileIconId: number | null
  summonerLevel: number | null
  backfillState: string
  /** How far back history has been pulled, so the UI can say "still syncing". */
  syncedFrom: string | null
}

export type GroupMemberOverview = {
  slug: string
  displayName: string
  accentColor: string | null
  accounts: MemberAccount[]
  ranks: MemberRank[]
  totals: {
    games: number
    wins: number
    winRate: number
    championsPlayed: number
    /** Arena only: Riot counts a podium as a win, so these are the games taken. */
    firstPlaces: number
  }
}

export type GroupOverview = {
  slug: string
  name: string
  timezone: string
  members: GroupMemberOverview[]
}

export class GroupService {
  async overview(group: Group, scope: QueueScope = DEFAULT_SCOPE): Promise<GroupOverview> {
    await group.load('members', (query) => query.preload('riotAccounts'))

    const memberIds = group.members.map((member) => member.id)
    if (memberIds.length === 0) {
      return { slug: group.slug, name: group.name, timezone: group.timezone, members: [] }
    }

    const [ranks, totals] = await Promise.all([
      this.#latestRanks(memberIds),
      this.#totals(memberIds, scope),
    ])

    return {
      slug: group.slug,
      name: group.name,
      timezone: group.timezone,
      members: group.members.map((member) => ({
        slug: member.slug,
        displayName: member.displayName,
        accentColor: member.accentColor,
        accounts: member.riotAccounts.map((account) => ({
          riotId: account.riotId,
          platform: account.platform,
          profileIconId: account.profileIconId,
          summonerLevel: account.summonerLevel,
          backfillState: account.backfillState,
          syncedFrom: account.syncedFrom?.toUTC().toISO() ?? null,
        })),
        ranks: ranks.get(member.id) ?? [],
        totals: totals.get(member.id) ?? {
          games: 0,
          wins: 0,
          winRate: 0,
          championsPlayed: 0,
          firstPlaces: 0,
        },
      })),
    }
  }

  /**
   * The current standing per queue. league_entries is append-only, so the
   * current value is the newest row - DISTINCT ON picks it in one pass instead
   * of a correlated subquery per account.
   */
  async #latestRanks(memberIds: number[]): Promise<Map<number, MemberRank[]>> {
    const rows = await db.rawQuery(
      `SELECT DISTINCT ON (a.member_id, e.queue_type)
              a.member_id, e.queue_type, e.tier, e.rank, e.league_points, e.wins, e.losses
       FROM league_entries e
       JOIN riot_accounts a ON a.id = e.riot_account_id
       WHERE a.member_id = ANY(?)
       ORDER BY a.member_id, e.queue_type, e.captured_at DESC`,
      [memberIds]
    )

    const byMember = new Map<number, MemberRank[]>()
    for (const row of rows.rows) {
      const list = byMember.get(row.member_id) ?? []
      list.push({
        queueType: row.queue_type,
        tier: row.tier,
        rank: row.rank,
        leaguePoints: row.league_points,
        wins: row.wins,
        losses: row.losses,
      })
      byMember.set(row.member_id, list)
    }

    return byMember
  }

  /** Lifetime totals across every account a member owns, smurfs included. */
  async #totals(memberIds: number[], scope: QueueScope) {
    const query = db
      .from('match_participants as p')
      .join('riot_accounts as a', 'a.puuid', 'p.puuid')
      .join('matches as m', 'm.match_id', 'p.match_id')
      .whereIn('a.member_id', memberIds)
      // Customs and bot games are stored but must not flatter an average.
      .andWhere('m.stats_eligible', true)
      .groupBy('a.member_id')
      .select('a.member_id')
      .count('* as games')
      .sum({ wins: db.raw('case when p.win then 1 else 0 end') })
      .countDistinct('p.champion_id as champions')
      .sum({
        // Arena reports a finishing position; every other mode leaves it null.
        firsts: db.raw('case when p.subteam_placement = 1 then 1 else 0 end'),
      })

    applyScope(query, scope)
    const rows = await query

    return new Map(
      rows.map((row: any) => {
        const games = Number(row.games)
        const wins = Number(row.wins)
        return [
          row.member_id,
          {
            games,
            wins,
            winRate: games === 0 ? 0 : Math.round((wins / games) * 1000) / 10,
            championsPlayed: Number(row.champions),
            firstPlaces: Number(row.firsts),
          },
        ]
      })
    )
  }
}
