import { test } from '@japa/runner'

import type { CustomGameView, CustomPlayerView, Side } from '#customs/custom_game_view'
import { customStandings } from '#customs/custom_standings'

function player(name: string, over: Partial<CustomPlayerView> = {}): CustomPlayerView {
  return {
    riotId: `${name}#EUW`,
    name,
    isBot: false,
    memberSlug: null,
    displayName: null,
    championId: 1,
    championName: 'Annie',
    position: null,
    level: 18,
    kills: 0,
    deaths: 0,
    assists: 0,
    cs: 0,
    wardScore: 0,
    items: [0, 0, 0, 0, 0, 0, 0],
    perks: { styles: [] },
    summonerSpells: [0, 0],
    bestMultikill: 0,
    ...over,
  }
}

/** A game between two lists of players, with `winner` taking it. */
function game(
  blue: CustomPlayerView[],
  red: CustomPlayerView[],
  winner: Side | null,
  over: Partial<CustomGameView> = {}
): CustomGameView {
  const objectives = { turrets: 0, inhibitors: 0, dragons: 0, grubs: 0, heralds: 0, barons: 0 }
  return {
    id: 1,
    label: null,
    playedAt: '2026-10-08T20:00:00.000Z',
    duration: 1800,
    gameMode: 'CLASSIC',
    mapName: "Summoner's Rift",
    capturedBy: null,
    resultKnown: winner !== null,
    resultSource: winner ? 'capture' : null,
    againstBots: false,
    firstBlood: null,
    teams: [
      { side: 'ORDER', won: winner === null ? null : winner === 'ORDER', kills: 0, objectives, players: blue },
      { side: 'CHAOS', won: winner === null ? null : winner === 'CHAOS', kills: 0, objectives, players: red },
    ],
    ...over,
  }
}

test.group('customStandings', () => {
  test('ranks by wins, and counts losses for the other side', ({ assert }) => {
    const a = player('Aki')
    const b = player('Bea')

    const { standings, counted } = customStandings([
      game([a], [b], 'ORDER'),
      game([a], [b], 'ORDER'),
      game([b], [a], 'ORDER'),
    ])

    assert.equal(counted, 3)
    assert.deepEqual(
      standings.map((row) => [row.name, row.wins, row.losses]),
      [
        ['Aki', 2, 1],
        ['Bea', 1, 2],
      ]
    )
    assert.equal(standings[0].winRate, 66.7)
  })

  /* Practice is not a win over anyone, so it is left out, not credited. */
  test('leaves games against bots out of the table and says so', ({ assert }) => {
    const bot = player('Ahri', { isBot: true })

    const result = customStandings([
      game([player('Aki')], [bot], 'ORDER', { againstBots: true }),
    ])

    assert.lengthOf(result.standings, 0)
    assert.equal(result.skipped.againstBots, 1)
  })

  test('never lists a bot, even in a game between humans', ({ assert }) => {
    const { standings } = customStandings([
      game([player('Aki'), player('Lux', { isBot: true })], [player('Bea')], 'CHAOS'),
    ])

    assert.sameMembers(
      standings.map((row) => row.name),
      ['Aki', 'Bea']
    )
  })

  test('skips a game nobody knows the winner of', ({ assert }) => {
    const result = customStandings([game([player('Aki')], [player('Bea')], null)])

    assert.lengthOf(result.standings, 0)
    assert.equal(result.skipped.unknownResult, 1)
  })

  test("folds a member's accounts into one line", ({ assert }) => {
    const main = player('froslass', { memberSlug: 'froslass', displayName: 'froslass' })
    const smurf = player('FOND DU LAC', { memberSlug: 'froslass', displayName: 'froslass' })

    const { standings } = customStandings([
      game([main], [player('Bea')], 'ORDER'),
      game([smurf], [player('Bea')], 'ORDER'),
    ])

    const row = standings.find((entry) => entry.memberSlug === 'froslass')!
    assert.equal(row.wins, 2)
    assert.equal(row.games, 2)
  })

  test('breaks a tie on wins with the better rate', ({ assert }) => {
    const a = player('Aki')
    const b = player('Bea')
    const c = player('Cyd')

    const { standings } = customStandings([
      game([a], [c], 'ORDER'),
      game([b], [c], 'ORDER'),
      game([b], [c], 'CHAOS'),
    ])

    // One win each for Aki and Bea, but Aki did it in one game.
    assert.deepEqual(
      standings.slice(0, 2).map((row) => row.name),
      ['Aki', 'Bea']
    )
  })
})
