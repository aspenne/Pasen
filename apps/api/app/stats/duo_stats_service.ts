import db from '@adonisjs/lucid/services/db'

import Group from '#models/group'
import { DEFAULT_SCOPE, type QueueScope } from '#stats/scope'
import { groupsInScope } from '@pasen/shared'

export type DuoPair = {
  a: string
  b: string
  games: number
  wins: number
  winRate: number
  /** Win rate each of them posts without the other, for comparison. */
  soloWinRateA: number
  soloWinRateB: number
}

export type DuoStats = {
  pairs: DuoPair[]
  /** Times two members ended up on opposite sides. */
  against: { a: string; b: string; games: number }[]
}

/**
 * "Played together" has to mean the same team, and a team is not the same shape
 * in every mode. Summoner's Rift and ARAM put five on a teamId; this Arena
 * variant puts eighteen players into six subteams of three, split across two
 * teamIds - so nine people share a teamId there and are mostly opponents.
 *
 * Both columns therefore have to match. coalesce keeps the comparison working
 * where subteam is null, which is every mode but Arena.
 */
const SAME_TEAM = `p2.team_id = p1.team_id
  AND coalesce(p2.subteam_id, -1) = coalesce(p1.subteam_id, -1)`

const OPPOSING = `(p2.team_id <> p1.team_id
  OR coalesce(p2.subteam_id, -1) <> coalesce(p1.subteam_id, -1))`

/**
 * Inlined rather than bound, because these queries are raw and the list is
 * generated from a closed union - never from user input. parseScope turns
 * anything unrecognised into the default before it gets here.
 */
function scopeClause(scope: QueueScope): string {
  const groups = groupsInScope(scope)
  if (!groups) {
    return ''
  }
  return `AND m.queue_group IN (${groups.map((g) => `'${g}'`).join(', ')})`
}

export class DuoStatsService {
  async forGroup(
    group: Group,
    minimumGames = 3,
    scope: QueueScope = DEFAULT_SCOPE
  ): Promise<DuoStats> {
    const [together, against, solo] = await Promise.all([
      this.#together(group.id, scope),
      this.#against(group.id, scope),
      this.#soloWinRates(group.id, scope),
    ])

    return {
      pairs: together
        .filter((row) => row.games >= minimumGames)
        .map((row) => ({
          ...row,
          soloWinRateA: solo.get(row.a) ?? 0,
          soloWinRateB: solo.get(row.b) ?? 0,
        })),
      against,
    }
  }

  async #together(
    groupId: number,
    scope: QueueScope
  ): Promise<Omit<DuoPair, 'soloWinRateA' | 'soloWinRateB'>[]> {
    const { rows } = await db.rawQuery(
      `SELECT mem1.slug AS a, mem2.slug AS b,
              count(*)::int AS games,
              sum(case when p1.win then 1 else 0 end)::int AS wins
       FROM match_participants p1
       JOIN match_participants p2
         ON p2.match_id = p1.match_id AND p2.puuid <> p1.puuid AND ${SAME_TEAM}
       JOIN matches m ON m.match_id = p1.match_id AND m.stats_eligible
       JOIN riot_accounts a1 ON a1.puuid = p1.puuid
       JOIN riot_accounts a2 ON a2.puuid = p2.puuid
       JOIN members mem1 ON mem1.id = a1.member_id
       JOIN members mem2 ON mem2.id = a2.member_id
       JOIN group_members g1 ON g1.member_id = a1.member_id AND g1.group_id = ?
       JOIN group_members g2 ON g2.member_id = a2.member_id AND g2.group_id = ?
       -- Each pair once, and never a member paired with their own smurf.
       WHERE a1.member_id < a2.member_id
         ${scopeClause(scope)}
       GROUP BY 1, 2
       ORDER BY games DESC`,
      [groupId, groupId]
    )

    return rows.map((row: any) => ({
      a: row.a,
      b: row.b,
      games: row.games,
      wins: row.wins,
      winRate: Math.round((row.wins / row.games) * 1000) / 10,
    }))
  }

  async #against(
    groupId: number,
    scope: QueueScope
  ): Promise<{ a: string; b: string; games: number }[]> {
    const { rows } = await db.rawQuery(
      `SELECT mem1.slug AS a, mem2.slug AS b, count(*)::int AS games
       FROM match_participants p1
       JOIN match_participants p2
         ON p2.match_id = p1.match_id AND p2.puuid <> p1.puuid AND ${OPPOSING}
       JOIN matches m ON m.match_id = p1.match_id AND m.stats_eligible
       JOIN riot_accounts a1 ON a1.puuid = p1.puuid
       JOIN riot_accounts a2 ON a2.puuid = p2.puuid
       JOIN members mem1 ON mem1.id = a1.member_id
       JOIN members mem2 ON mem2.id = a2.member_id
       JOIN group_members g1 ON g1.member_id = a1.member_id AND g1.group_id = ?
       JOIN group_members g2 ON g2.member_id = a2.member_id AND g2.group_id = ?
       WHERE a1.member_id < a2.member_id
         ${scopeClause(scope)}
       GROUP BY 1, 2
       ORDER BY games DESC`,
      [groupId, groupId]
    )

    return rows.map((row: any) => ({ a: row.a, b: row.b, games: row.games }))
  }

  /**
   * Overall win rate per member. A duo is only interesting next to what each of
   * them does apart: 55% together means nothing until you know one of them wins
   * 60% alone.
   */
  async #soloWinRates(groupId: number, scope: QueueScope): Promise<Map<string, number>> {
    const rows = await db
      .from('match_participants as p')
      .join('matches as m', 'm.match_id', 'p.match_id')
      .join('riot_accounts as a', 'a.puuid', 'p.puuid')
      .join('members as mem', 'mem.id', 'a.member_id')
      .join('group_members as g', (join) =>
        join.on('g.member_id', 'a.member_id').andOnVal('g.group_id', groupId)
      )
      .where('m.stats_eligible', true)
      .if(groupsInScope(scope), (q) => q.whereIn('m.queue_group', groupsInScope(scope)!))
      .groupBy('mem.slug')
      .select('mem.slug')
      .count('* as games')
      .sum({ wins: db.raw('case when p.win then 1 else 0 end') })

    return new Map(
      rows.map((row: any) => [
        row.slug,
        Math.round((Number(row.wins) / Number(row.games)) * 1000) / 10,
      ])
    )
  }
}
