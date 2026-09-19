import db from '@adonisjs/lucid/services/db'
import type { QueueGroup } from '@pasen/shared'

import Group from '#models/group'

export type MatchDetailPlayer = {
  puuid: string
  /** Null for players whose Riot ID Riot did not return with the match. */
  riotId: string | null
  championId: number
  championName: string
  teamPosition: string | null
  win: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  goldEarned: number
  damageDealt: number
  visionScore: number
  champLevel: number
  items: number[]
  summonerSpells: [number, number]
  /** Set when this player is tracked by the group being viewed. */
  memberSlug: string | null
  displayName: string | null
  accentColor: string | null
}

export type MatchDetailSide = {
  /** Team id on the Rift; subteam id in Arena, where a "team" is two players. */
  id: number
  win: boolean
  /** Arena only: where this duo finished, 1 through 8. */
  placement: number | null
  kills: number
  goldEarned: number
  players: MatchDetailPlayer[]
}

export type MatchDetail = {
  matchId: string
  queueId: number
  queueGroup: QueueGroup
  gameMode: string
  gameCreation: string
  gameDuration: number
  sides: MatchDetailSide[]
}

/**
 * Everyone who was in one game, not just the members of the group.
 *
 * Served on its own rather than folded into the daily feed: a day of games
 * carries ten times the rows this way, and almost none of them are ever looked
 * at. The card asks for this only once someone opens it.
 */
export class MatchDetailService {
  async forMatch(group: Group, matchId: string): Promise<MatchDetail | null> {
    const match = await db
      .from('matches')
      .where('match_id', matchId)
      .select(
        'match_id',
        'queue_id',
        'queue_group',
        'game_mode',
        'game_creation',
        'game_duration'
      )
      .first()

    if (!match) return null

    const rows = await db
      .from('match_participants as p')
      /*
       * Left joins: a player is annotated when they are tracked by this group,
       * and stays an anonymous opponent otherwise.
       */
      .leftJoin('riot_accounts as a', 'a.puuid', 'p.puuid')
      .leftJoin('group_members as g', (join) =>
        join.on('g.member_id', 'a.member_id').andOnVal('g.group_id', group.id)
      )
      // Keyed off the pivot, so only members of this group are annotated.
      .leftJoin('members as mem', 'mem.id', 'g.member_id')
      .where('p.match_id', matchId)
      .select(
        'p.puuid',
        'p.team_id',
        'p.subteam_id',
        'p.subteam_placement',
        'p.champion_id',
        'p.champion_name',
        'p.team_position',
        'p.win',
        'p.kills',
        'p.deaths',
        'p.assists',
        'p.cs',
        'p.gold_earned',
        'p.damage_dealt',
        'p.vision_score',
        'p.champ_level',
        'p.items',
        'p.summoner1_id',
        'p.summoner2_id',
        'p.riot_id_game_name',
        'p.riot_id_tag_line',
        'mem.slug as member_slug',
        'mem.display_name',
        'mem.accent_color'
      )

    const sides = new Map<number, MatchDetailSide>()

    for (const row of rows) {
      // Arena splits one team id across three duos, so the subteam is the side.
      const id = row.subteam_id ?? row.team_id
      let side = sides.get(id)
      if (!side) {
        side = {
          id,
          win: row.win,
          placement: row.subteam_placement,
          kills: 0,
          goldEarned: 0,
          players: [],
        }
        sides.set(id, side)
      }

      side.kills += row.kills
      side.goldEarned += Number(row.gold_earned)
      side.players.push({
        puuid: row.puuid,
        riotId: row.riot_id_game_name
          ? `${row.riot_id_game_name}#${row.riot_id_tag_line}`
          : null,
        championId: row.champion_id,
        championName: row.champion_name,
        teamPosition: row.team_position,
        win: row.win,
        kills: row.kills,
        deaths: row.deaths,
        assists: row.assists,
        cs: row.cs,
        goldEarned: Number(row.gold_earned),
        damageDealt: Number(row.damage_dealt),
        visionScore: row.vision_score,
        champLevel: row.champ_level,
        items: row.items ?? [],
        summonerSpells: [row.summoner1_id, row.summoner2_id],
        memberSlug: row.member_slug ?? null,
        displayName: row.display_name ?? null,
        accentColor: row.accent_color ?? null,
      })
    }

    // Arena reads as a ladder, the Rift as blue side then red.
    const ordered = [...sides.values()].sort((a, b) =>
      a.placement !== null && b.placement !== null ? a.placement - b.placement : a.id - b.id
    )

    for (const side of ordered) {
      side.players.sort((a, b) => POSITIONS.indexOf(a.teamPosition ?? '') - POSITIONS.indexOf(b.teamPosition ?? ''))
    }

    return {
      matchId: match.match_id,
      queueId: match.queue_id,
      queueGroup: match.queue_group,
      gameMode: match.game_mode,
      gameCreation: new Date(match.game_creation).toISOString(),
      gameDuration: match.game_duration,
      sides: ordered,
    }
  }
}

/** Lane order, so a team reads top to support the way every client shows it. */
const POSITIONS = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']
