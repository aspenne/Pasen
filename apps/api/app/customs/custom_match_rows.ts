import type { CustomGameView } from '#customs/custom_game_view'

/**
 * A captured inhouse, written as the rows every other game on the site is
 * made of.
 *
 * The match tables are what the queue filter narrows, and every page reads
 * them: the feed, the roster, a player's page, Insights. Mirroring a custom
 * into them under its own queue group is what lets "Customs" be one more
 * choice in that filter instead of a section that knows nothing of the rest.
 *
 * Pure, so what lands in the tables can be read and tested without a database.
 */
export const CUSTOM_MATCH_PREFIX = 'CUSTOM_'

export function customMatchId(customGameId: number): string {
  return `${CUSTOM_MATCH_PREFIX}${customGameId}`
}

/** The custom game's id, or null for a match that is not a mirrored custom. */
export function customGameIdOf(matchId: string): number | null {
  if (!matchId.startsWith(CUSTOM_MATCH_PREFIX)) return null
  const id = Number(matchId.slice(CUSTOM_MATCH_PREFIX.length))
  return Number.isInteger(id) && id > 0 ? id : null
}

/**
 * Which customs belong in the match tables at all.
 *
 * Practice against bots is not a game anyone in the group played against
 * anyone - it stays on the customs page and nowhere else. A game nobody knows
 * the winner of cannot be written either: `win` is not nullable, and false for
 * both sides would hand everyone a loss that never happened. Deciding the
 * winner by hand is what brings such a game in.
 */
export function mirrorable(view: CustomGameView): boolean {
  return !view.againstBots && view.resultKnown
}

export type CustomMatchRows = {
  match: Record<string, unknown>
  participants: Record<string, unknown>[]
}

export function customMatchRows(
  view: CustomGameView,
  puuidByRiotId: Map<string, string>,
  platform: string,
  now: Date
): CustomMatchRows {
  const matchId = customMatchId(view.id)
  const startedAt = new Date(view.playedAt)

  const participants = view.teams.flatMap((team) =>
    team.players.map((player, index) => {
      const [gameName, tagLine] = player.riotId.split('#')

      /*
       * A member's real puuid is what joins this game to their pages. Anyone
       * else gets a stable stand-in that joins to no account - a stranger, the
       * same as any opponent in a Riot game. Bots also carry their side and
       * seat: two Galio bots in one lobby is a real case, and the primary key
       * is the match and the puuid.
       */
      const puuid = player.isBot
        ? `custom-bot:${team.side}:${index}:${player.championName}`
        : (puuidByRiotId.get(player.riotId.toLowerCase()) ?? `custom:${player.riotId.toLowerCase()}`)

      return {
        match_id: matchId,
        puuid: puuid.slice(0, 100),
        team_id: team.side === 'ORDER' ? 100 : 200,
        subteam_id: null,
        subteam_placement: null,
        champion_id: player.championId,
        champion_name: player.championName.slice(0, 30),
        team_position: player.position,
        individual_position: player.position,
        win: team.won === true,
        kills: player.kills,
        deaths: player.deaths,
        assists: player.assists,
        /*
         * The Live Client reports no gold or damage for the other players, so
         * these are zero rather than invented - and a page reading them under
         * the Customs filter shows nothing rather than a guess.
         */
        gold_earned: 0,
        cs: player.cs,
        damage_dealt: 0,
        damage_taken: 0,
        vision_score: Math.round(player.wardScore),
        wards_placed: 0,
        wards_killed: 0,
        champ_level: player.level,
        summoner1_id: player.summonerSpells[0],
        summoner2_id: player.summonerSpells[1],
        items: JSON.stringify(player.items),
        perks: JSON.stringify(player.perks),
        riot_id_game_name: player.isBot ? player.championName : gameName,
        riot_id_tag_line: player.isBot ? 'BOT' : (tagLine ?? null),
        double_kills: player.multikills.double,
        triple_kills: player.multikills.triple,
        quadra_kills: player.multikills.quadra,
        penta_kills: player.multikills.penta,
        first_blood_kill: player.firstBlood,
        early_surrender: false,
      }
    })
  )

  return {
    match: {
      match_id: matchId,
      platform,
      queue_id: 0,
      queue_group: 'custom',
      game_mode: view.gameMode.slice(0, 30),
      game_type: 'CUSTOM_GAME',
      game_version: 'capture',
      game_creation: startedAt,
      game_duration: view.duration,
      game_ended_at: new Date(startedAt.getTime() + view.duration * 1000),
      participant_count: participants.length,
      stats_eligible: true,
      /*
       * A pointer, not the capture. The capture already lives in custom_games;
       * a second copy here would be one more place to drift, and code reading
       * `raw` as a match-v5 payload finds nothing rather than something wrong.
       */
      raw: JSON.stringify({ source: 'custom-capture', customGameId: view.id }),
      ingested_at: now,
    },
    participants,
  }
}
