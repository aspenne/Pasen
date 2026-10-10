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

function seatOf(member) {
  if (member.isBot) {
    return { puuid: null, name: member.botChampionName ? `${member.botChampionName} bot` : botName(member), bot: true }
  }
  const riotId = member.gameName ? `${member.gameName}${member.tagLine ? `#${member.tagLine}` : ''}` : ''
  return {
    puuid: member.puuid || null,
    name: riotId || member.summonerName || member.summonerInternalName || 'Player',
    bot: false,
  }
}

/** "Bot_Ahri" is the closest the payload comes to naming a bot. */
function botName(member) {
  const champion = String(member.botId || '').replace(/^Bot_/, '')
  return champion ? `${champion} bot` : 'Bot'
}

/** Customs that are not a game between friends: alone in Practice Tool is not a lobby to deal roles in. */
const NOT_A_MATCH = new Set(['PRACTICETOOL', 'TUTORIAL'])

function teamsFromLobby(lobby) {
  const config = lobby?.gameConfig
  if (!config?.isCustom || NOT_A_MATCH.has(config.gameMode)) return null
  const side = (list) =>
    (Array.isArray(list) ? list : [])
      .filter((m) => m && typeof m === 'object' && !m.isSpectator)
      .slice(0, TEAM_SIZE)
      .map(seatOf)
  const teams = { blue: side(config.customTeam100), red: side(config.customTeam200) }
  const humans = [...teams.blue, ...teams.red].filter((seat) => !seat.bot).length
  return humans >= 2 ? teams : null
}

/** Same players in the same places. */
function sameTeams(a, b) {
  if (!a || !b) return a === b
  const key = (t) => JSON.stringify([t.blue, t.red].map((s) => s.map((x) => [x.puuid, x.name, x.bot])))
  return key(a) === key(b)
}

module.exports = { teamsFromLobby, sameTeams }
