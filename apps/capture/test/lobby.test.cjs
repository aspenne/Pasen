'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')

const { teamsFromLobby, sameTeams } = require('../src/lobby.cjs')
const custom = require('./fixtures/lobby-custom.json')
const ranked = require('./fixtures/lobby-ranked.json')

test('reads both sides of a custom lobby, bots included, spectators left out', () => {
  const teams = teamsFromLobby(custom)
  assert.equal(teams.blue.length, 5)
  assert.equal(teams.red.length, 5)
  assert.deepEqual(teams.blue[1], { puuid: 'puuid-nøah', name: 'Nøah#SHEN', bot: false })
  assert.deepEqual(teams.blue[4], { puuid: null, name: 'Bot', bot: true, championId: 103 })
  assert.ok(![...teams.blue, ...teams.red].some((seat) => seat.name.startsWith('Adam')))
})

test('ignores anything that is not a custom lobby', () => {
  assert.equal(teamsFromLobby(ranked), null)
  assert.equal(teamsFromLobby(null), null)
  assert.equal(teamsFromLobby({}), null)
})

test('falls back to the summoner name when the Riot ID is missing', () => {
  const lobby = structuredClone(custom)
  lobby.gameConfig.customTeam100[0].gameName = ''
  lobby.gameConfig.customTeam100[0].tagLine = ''
  assert.equal(teamsFromLobby(lobby).blue[0].name, '3C Patate Chaude')
})

test('tells a changed lobby from the same one polled again', () => {
  const a = teamsFromLobby(custom)
  assert.equal(sameTeams(a, teamsFromLobby(structuredClone(custom))), true)
  const moved = structuredClone(custom)
  moved.gameConfig.customTeam200.push(moved.gameConfig.customTeam100.shift())
  assert.equal(sameTeams(a, teamsFromLobby(moved)), false)
  assert.equal(sameTeams(null, a), false)
})

test('takes a custom of one player against bots, the way to try the roulette alone', () => {
  const lobby = structuredClone(custom)
  const bot = (team, champion) => ({ isBot: true, botId: `Bot_${champion}`, teamId: team, puuid: '', summonerName: '' })
  lobby.gameConfig.customTeam100 = [lobby.gameConfig.customTeam100[0], ...['Annie', 'Lux', 'Garen', 'Ashe'].map((c) => bot(100, c))]
  lobby.gameConfig.customTeam200 = ['Darius', 'Ahri', 'Jinx', 'Leona', 'Warwick'].map((c) => bot(200, c))
  const teams = teamsFromLobby(lobby)
  assert.equal(teams.blue.length, 5)
  assert.equal(teams.red.length, 5)
  assert.equal(teams.red[0].bot, true)
})

test('ignores Practice Tool and someone alone in a custom', () => {
  const practice = structuredClone(custom)
  practice.gameConfig.gameMode = 'PRACTICETOOL'
  assert.equal(teamsFromLobby(practice), null)

  const alone = structuredClone(custom)
  alone.gameConfig.customTeam100 = alone.gameConfig.customTeam100.slice(0, 1)
  alone.gameConfig.customTeam200 = []
  assert.equal(teamsFromLobby(alone), null)
})

test('does not trip on a broken member entry', () => {
  const broken = structuredClone(custom)
  broken.gameConfig.customTeam100.push(null)
  assert.equal(teamsFromLobby(broken).blue.length, 5)
})

test('names players from the Riot IDs the client gives, the lobby itself carrying none', () => {
  const lobby = structuredClone(custom)
  for (const m of lobby.gameConfig.customTeam100) {
    m.gameName = ''
    m.tagLine = ''
    m.summonerName = ''
  }
  const names = new Map([['puuid-nøah', 'Nøah#SHEN']])
  const teams = teamsFromLobby(lobby, names)
  assert.equal(teams.blue[1].name, 'Nøah#SHEN')
  assert.equal(teams.blue[0].name, 'Player')
})

test("gives a bot its champion, not the client's internal id", () => {
  const lobby = structuredClone(custom)
  Object.assign(lobby.gameConfig.customTeam100[4], { botId: 'fda5b28f-cb04-4a63-b966-a250a014f100', botChampionId: 103 })
  assert.deepEqual(teamsFromLobby(lobby).blue[4], { puuid: null, name: 'Bot', bot: true, championId: 103 })
})

test('lists the players whose Riot ID is still to be asked', () => {
  const { humansToName } = require('../src/lobby.cjs')
  assert.deepEqual(humansToName(custom, new Map([['puuid-nøah', 'Nøah#SHEN']])).slice(0, 2), [
    'puuid-3c-patate-chaude',
    'puuid-froslass',
  ])
})
