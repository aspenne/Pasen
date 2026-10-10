'use strict'

/**
 * The two sides of a custom lobby, out of the League client's own lobby
 * payload. Anything that is not a custom lobby - ranked, normal, no lobby at
 * all - is null: the app never tells the site about those.
 *
 * Shaped after the client's /lol-lobby/v2/lobby; checked against a real
 * snapshot taken with "Save lobby snapshot" in the tray menu.
 */
const TEAM_SIZE = 5

/**
 * Since Riot IDs replaced summoner names, the lobby carries no player name at
 * all - only the client's own puuid, which is not the one Riot's public API
 * gives Pasen. So names are asked of the client separately (`names`, puuid to
 * "Name#TAG"), and the site recognises members by that Riot ID.
 */
function seatOf(member, names) {
  if (member.isBot) {
    // A bot's id is an internal UUID; its champion is what tells it apart.
    return { puuid: null, name: 'Bot', bot: true, championId: Number(member.botChampionId) || null }
  }
  const own = member.gameName ? `${member.gameName}${member.tagLine ? `#${member.tagLine}` : ''}` : ''
  return {
    puuid: member.puuid || null,
    name: names?.get(member.puuid) || own || member.summonerName || member.summonerInternalName || 'Player',
    bot: false,
  }
}

function membersOf(config, key) {
  return (Array.isArray(config?.[key]) ? config[key] : []).filter((m) => m && typeof m === 'object' && !m.isSpectator)
}

/** The humans in a custom lobby whose Riot ID has not been asked for yet. */
function humansToName(lobby, names) {
  const config = lobby?.gameConfig
  if (!config?.isCustom) return []
  return [...membersOf(config, 'customTeam100'), ...membersOf(config, 'customTeam200')]
    .filter((m) => !m.isBot && m.puuid && !names?.has(m.puuid))
    .map((m) => m.puuid)
}

/** Customs that are not a game between friends: alone in Practice Tool is not a lobby to deal roles in. */
const NOT_A_MATCH = new Set(['PRACTICETOOL', 'TUTORIAL'])

function teamsFromLobby(lobby, names) {
  const config = lobby?.gameConfig
  if (!config?.isCustom || NOT_A_MATCH.has(config.gameMode)) return null
  const side = (key) => membersOf(config, key).slice(0, TEAM_SIZE).map((m) => seatOf(m, names))
  const teams = { blue: side('customTeam100'), red: side('customTeam200') }
  // Two places taken, bots included: one player against bots is a fine way to try
  // the roulette, while someone alone - as in Practice Tool - is not a lobby.
  return teams.blue.length + teams.red.length >= 2 ? teams : null
}

/** Same players in the same places. */
function sameTeams(a, b) {
  if (!a || !b) return a === b
  const key = (t) => JSON.stringify([t.blue, t.red].map((s) => s.map((x) => [x.puuid, x.name, x.bot, x.championId ?? null])))
  return key(a) === key(b)
}

module.exports = { teamsFromLobby, sameTeams, humansToName }
