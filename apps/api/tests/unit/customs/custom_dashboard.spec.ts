import { test } from '@japa/runner'

import { customDashboard } from '#customs/custom_dashboard'
import type { CustomGameView, CustomPlayerView, Side } from '#customs/custom_game_view'

let nextId = 1

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
    multikills: { double: 0, triple: 0, quadra: 0, penta: 0 },
    firstBlood: false,
    ...over,
  }
}

function game(
  blue: CustomPlayerView[],
  red: CustomPlayerView[],
  winner: Side | null,
  over: Partial<CustomGameView> = {}
): CustomGameView {
  const objectives = { turrets: 0, inhibitors: 0, dragons: 0, grubs: 0, heralds: 0, barons: 0 }
  const sum = (list: CustomPlayerView[]) => list.reduce((total, p) => total + p.kills, 0)
  return {
    id: nextId++,
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
      { side: 'ORDER', won: winner === null ? null : winner === 'ORDER', kills: sum(blue), objectives, players: blue },
      { side: 'CHAOS', won: winner === null ? null : winner === 'CHAOS', kills: sum(red), objectives, players: red },
    ],
    ...over,
  }
}

test.group('customDashboard', () => {
  test('leaves practice against bots out of every number', ({ assert }) => {
    const dashboard = customDashboard([
      game([player('Aki', { kills: 30 })], [player('Ahri', { isBot: true })], 'ORDER', {
        againstBots: true,
      }),
    ])

    assert.equal(dashboard.counted, 0)
    assert.lengthOf(dashboard.players, 0)
    assert.lengthOf(dashboard.records, 0)
  })

  test("averages a player's games, CS by the minutes they played", ({ assert }) => {
    const dashboard = customDashboard([
      game([player('Aki', { kills: 10, deaths: 2, assists: 4, cs: 200 })], [player('Bea')], 'ORDER', {
        duration: 1200,
      }),
      game([player('Aki', { kills: 4, deaths: 4, assists: 2, cs: 100 })], [player('Bea')], 'CHAOS', {
        duration: 600,
      }),
    ])

    const aki = dashboard.players.find((line) => line.name === 'Aki')!
    assert.equal(aki.games, 2)
    assert.equal(aki.kda, 3.33)
    assert.equal(aki.killsPerGame, 7)
    // 300 CS over 30 minutes.
    assert.equal(aki.csPerMinute, 10)
  })

  test('credits first blood by the game name the capture uses', ({ assert }) => {
    const dashboard = customDashboard([
      game([player('Aki', { kills: 1 })], [player('Bea')], 'ORDER', { firstBlood: 'Aki' }),
    ])

    assert.equal(dashboard.players.find((line) => line.name === 'Aki')!.firstBloods, 1)
    assert.equal(dashboard.players.find((line) => line.name === 'Bea')!.firstBloods, 0)
  })

  test('keeps a record with whoever set it first', ({ assert }) => {
    const first = game([player('Aki', { kills: 20, championName: 'Zed', championId: 238 })], [player('Bea')], 'ORDER')
    const later = game([player('Bea', { kills: 20 })], [player('Aki')], 'ORDER')

    const record = customDashboard([first, later]).records.find((line) => line.kind === 'kills')!

    assert.equal(record.name, 'Aki')
    assert.equal(record.championName, 'Zed')
    assert.equal(record.gameId, first.id)
  })

  /*
   * The kills in a game nobody knows the result of still happened, so they
   * count; who won it is unknown, so it says nothing about sides or duos.
   */
  test('counts an unresolved game for performance but not for winning', ({ assert }) => {
    const a = player('Aki', { kills: 5 })
    const b = player('Bea', { kills: 5 })

    const dashboard = customDashboard([game([a, b], [player('Cyd')], null), game([a, b], [player('Cyd')], null)])

    assert.equal(dashboard.counted, 2)
    assert.equal(dashboard.resolved, 0)
    assert.equal(dashboard.players.find((line) => line.name === 'Aki')!.games, 2)
    assert.lengthOf(dashboard.duos, 0)
    assert.equal(dashboard.overview.blueWins + dashboard.overview.redWins, 0)
    // Annie, picked by both in both games: a pick, with no result to rate.
    assert.isNull(dashboard.champions[0].winRate)
  })

  test('finds the pair that wins together, on the same side only', ({ assert }) => {
    const aki = player('Aki')
    const bea = player('Bea')
    const cyd = player('Cyd')

    const dashboard = customDashboard([
      game([aki, bea], [cyd], 'ORDER'),
      game([aki, bea], [cyd], 'ORDER'),
      game([aki, cyd], [bea], 'CHAOS'),
    ])

    assert.lengthOf(dashboard.duos, 1)
    const [duo] = dashboard.duos
    assert.sameMembers([duo.a.name, duo.b.name], ['Aki', 'Bea'])
    assert.equal(duo.wins, 2)
    assert.equal(duo.winRate, 100)
  })

  test('counts champions by how often and by how many people they were picked', ({ assert }) => {
    const dashboard = customDashboard([
      game([player('Aki', { championId: 157, championName: 'Yasuo' })], [player('Bea', { championId: 157, championName: 'Yasuo' })], 'ORDER'),
      game([player('Aki', { championId: 157, championName: 'Yasuo' })], [player('Bea', { championId: 99, championName: 'Lux' })], 'CHAOS'),
    ])

    const yasuo = dashboard.champions.find((line) => line.championName === 'Yasuo')!
    assert.equal(yasuo.games, 3)
    assert.equal(yasuo.players, 2)
    // Won as Aki in game one, lost as Bea in game one, lost as Aki in game two.
    assert.equal(yasuo.winRate, 33.3)
  })

  test('tallies sides and the average length', ({ assert }) => {
    const dashboard = customDashboard([
      game([player('Aki')], [player('Bea')], 'ORDER', { duration: 1000 }),
      game([player('Aki')], [player('Bea')], 'CHAOS', { duration: 2000 }),
      game([player('Aki')], [player('Bea')], 'CHAOS', { duration: 3000 }),
    ])

    assert.equal(dashboard.overview.blueWins, 1)
    assert.equal(dashboard.overview.redWins, 2)
    assert.equal(dashboard.overview.averageDuration, 2000)
  })

  test('leaves out a champion picked only once', ({ assert }) => {
    const dashboard = customDashboard([
      game([player('Aki', { championId: 157, championName: 'Yasuo' })], [player('Bea', { championId: 99, championName: 'Lux' })], 'ORDER'),
    ])

    assert.lengthOf(dashboard.champions, 0)
  })
})
