import db from '@adonisjs/lucid/services/db'
import { groupsInScope } from '@pasen/shared'

import Member from '#models/member'
import { DEFAULT_SCOPE, type QueueScope } from '#stats/scope'

export type ProfileCard = {
  /** Most played position, and the share of games played in it. */
  mainRole: string | null
  roleShare: number | null
  hoursPlayed: number
  /** Share of the team's kills this player took part in, averaged per game. */
  killParticipation: number | null
  /** Longest run of wins, in order. */
  bestStreak: number
  /** Highest multikill reached, and how many times - never a zero pentakill. */
  bestMultikill: { kind: 'penta' | 'quadra' | 'triple' | 'double'; count: number } | null
  bestChampion: { championName: string; games: number; winRate: number } | null
}

/** Below this a win rate is luck, not a signature. */
const BEST_CHAMPION_MINIMUM = 15

/**
 * The scope as a SQL fragment. Safe because QueueScope is a closed union and
 * the values are the service's own constants, never anything a caller typed.
 */
function scopeClause(scope: QueueScope): string {
  const groups = groupsInScope(scope)
  if (!groups) return ''
  return `AND m.queue_group IN (${groups.map((g) => `'${g}'`).join(', ')})`
}

/**
 * The figures behind a player's recap card.
 *
 * Kill participation is only answerable because we store all ten participants
 * of every match rather than just the members of the group - the team's kill
 * total has to come from somewhere.
 */
export class ProfileCardService {
  async forMember(member: Member, scope: QueueScope = DEFAULT_SCOPE): Promise<ProfileCard> {
    const clause = scopeClause(scope)

    const base = `
      FROM match_participants p
      JOIN matches m ON m.match_id = p.match_id
      JOIN riot_accounts a ON a.puuid = p.puuid
      WHERE a.member_id = ? AND m.stats_eligible ${clause}
    `

    const roles = await db.rawQuery(
      `SELECT p.team_position AS role, count(*)::int AS games ${base}
         AND p.team_position IS NOT NULL AND p.team_position <> ''
       GROUP BY 1 ORDER BY 2 DESC`,
      [member.id]
    )

    const totals = await db.rawQuery(
      `SELECT count(*)::int AS games,
              coalesce(sum(m.game_duration), 0)::bigint AS seconds,
              coalesce(sum(p.penta_kills), 0)::int AS pentas,
              coalesce(sum(p.quadra_kills), 0)::int AS quadras,
              coalesce(sum(p.triple_kills), 0)::int AS triples,
              coalesce(sum(p.double_kills), 0)::int AS doubles
       ${base}`,
      [member.id]
    )

    const participation = await db.rawQuery(
      `WITH mine AS (
         SELECT p.match_id, p.team_id, p.kills, p.assists ${base}
       ), team AS (
         SELECT mine.match_id, sum(tp.kills)::int AS team_kills
         FROM mine
         JOIN match_participants tp
           ON tp.match_id = mine.match_id AND tp.team_id = mine.team_id
         GROUP BY 1
       )
       SELECT round(avg(
                CASE WHEN team.team_kills > 0
                     THEN (mine.kills + mine.assists)::numeric / team.team_kills END
              ) * 100, 1) AS kp
       FROM mine JOIN team ON team.match_id = mine.match_id`,
      [member.id]
    )

    /*
     * Gaps and islands: a run of wins shares one value of (row number overall
     * minus row number among wins), so grouping on that difference measures
     * each streak without walking the history in application code.
     */
    const streak = await db.rawQuery(
      `WITH games AS (
         SELECT p.win,
                row_number() OVER (ORDER BY m.game_creation) AS n,
                row_number() OVER (PARTITION BY p.win ORDER BY m.game_creation) AS wn
         ${base}
       )
       SELECT coalesce(max(len), 0)::int AS best FROM (
         SELECT count(*)::int AS len FROM games WHERE win GROUP BY (n - wn)
       ) runs`,
      [member.id]
    )

    const best = await db.rawQuery(
      `SELECT p.champion_name AS name, count(*)::int AS games,
              round(100.0 * sum(CASE WHEN p.win THEN 1 ELSE 0 END) / count(*), 1) AS win_rate
       ${base}
       GROUP BY 1 HAVING count(*) >= ${BEST_CHAMPION_MINIMUM}
       ORDER BY win_rate DESC, games DESC LIMIT 1`,
      [member.id]
    )

    const roleRows = roles.rows as { role: string; games: number }[]
    const totalRoleGames = roleRows.reduce((sum, row) => sum + row.games, 0)
    const top = roleRows[0] ?? null

    const t = totals.rows[0]
    const bestChampion = best.rows[0]
      ? {
          championName: best.rows[0].name as string,
          games: best.rows[0].games as number,
          winRate: Number(best.rows[0].win_rate),
        }
      : null

    return {
      mainRole: top?.role ?? null,
      roleShare:
        top && totalRoleGames > 0 ? Math.round((top.games / totalRoleGames) * 100) : null,
      hoursPlayed: Math.round(Number(t?.seconds ?? 0) / 360) / 10,
      killParticipation: participation.rows[0]?.kp === null ? null : Number(participation.rows[0]?.kp),
      bestStreak: streak.rows[0]?.best ?? 0,
      bestMultikill: bestMultikill(t),
      bestChampion,
    }
  }
}

/** The highest one actually reached. A card saying "0 pentakills" says nothing. */
function bestMultikill(row: {
  pentas: number
  quadras: number
  triples: number
  doubles: number
}): ProfileCard['bestMultikill'] {
  if (!row) return null
  if (row.pentas > 0) return { kind: 'penta', count: row.pentas }
  if (row.quadras > 0) return { kind: 'quadra', count: row.quadras }
  if (row.triples > 0) return { kind: 'triple', count: row.triples }
  if (row.doubles > 0) return { kind: 'double', count: row.doubles }
  return null
}
