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
  assert.deepEqual(teams.blue[4], { puuid: null, name: 'Ahri bot', bot: true })
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

test('ignores Practice Tool and a custom with fewer than two players', () => {
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
