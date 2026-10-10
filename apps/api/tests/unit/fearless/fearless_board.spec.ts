import { test } from '@japa/runner'

import type { CustomGameView, CustomPlayerView } from '#customs/custom_game_view'
import { fearlessBoard, nightEndsAt, type NightInput } from '#fearless/fearless_board'

const START = new Date('2026-10-10T19:00:00.000Z')
const at = (minutes: number) => new Date(START.getTime() + minutes * 60_000)

function player(name: string, championId: number, over: Partial<CustomPlayerView> = {}) {
  return {
    riotId: `${name}#EUW`,
    name,
    isBot: false,
    memberSlug: null,
    displayName: null,
    championId,
    championName: `Champ ${championId}`,
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
  } as CustomPlayerView
}

/** A custom that starts `startMinutes` after the night and lasts 30 minutes. */
function game(id: number, startMinutes: number, blue: CustomPlayerView[], red: CustomPlayerView[] = []) {
  const objectives = { turrets: 0, inhibitors: 0, dragons: 0, grubs: 0, heralds: 0, barons: 0 }
  return {
    id,
    label: null,
    playedAt: at(startMinutes).toISOString(),
    duration: 1800,
    gameMode: 'CLASSIC',
    mapName: "Summoner's Rift",
    capturedBy: null,
    resultKnown: false,
    resultSource: null,
    againstBots: false,
    firstBlood: null,
    teams: [
      { side: 'ORDER', won: null, kills: 0, objectives, players: blue },
      { side: 'CHAOS', won: null, kills: 0, objectives, players: red },
    ],
  } as CustomGameView
}

function night(over: Partial<NightInput> = {}): NightInput {
  return { id: 1, label: null, startedAt: START, endedAt: null, excludedCustomIds: [], ...over }
}

const burnedIds = (board: ReturnType<typeof fearlessBoard>) =>
  board.burned.map((burn) => burn.championId).sort((a, b) => a - b)

test.group('fearlessBoard', () => {
  test('burns every champion of every game in the night, both sides and bots', ({ assert }) => {
    const board = fearlessBoard(
      night(),
      [game(1, 0, [player('Noah', 1)], [player('Ahri Bot', 2, { isBot: true })])],
      [],
      at(60)
    )
    assert.deepEqual(burnedIds(board), [1, 2])
    assert.deepEqual(board.burned[0].by, [{ playerName: 'Noah', memberSlug: null, gameNumber: 1 }])
    assert.equal(board.burned[0].source, 'played')
  })

  test('names a member by their display name', ({ assert }) => {
    const board = fearlessBoard(
      night(),
      [game(1, 0, [player('Patate', 1, { memberSlug: 'patate', displayName: 'Patate Chaude' })])],
      [],
      at(60)
    )
    assert.equal(board.burned[0].by[0].playerName, 'Patate Chaude')
    assert.equal(board.games[0].picks[0].memberSlug, 'patate')
  })

  test('counts a game that started before the night but ended after it began', ({ assert }) => {
    // Starts 20 minutes before the click, ends 10 minutes after it.
    const board = fearlessBoard(night(), [game(1, -20, [player('Noah', 1)])], [], at(60))
    assert.deepEqual(burnedIds(board), [1])
  })

  test('leaves out a game that ended before the night began', ({ assert }) => {
    const board = fearlessBoard(night(), [game(1, -40, [player('Noah', 1)])], [], at(60))
    assert.deepEqual(board.games, [])
    assert.deepEqual(board.burned, [])
  })

  test('closes by itself six hours after it started', ({ assert }) => {
    // Ends at 6 h 30: past the cap, so it belongs to no night.
    const board = fearlessBoard(night(), [game(1, 360, [player('Noah', 1)])], [], at(24 * 60))
    assert.deepEqual(board.burned, [])
    assert.isFalse(board.night.active)
    assert.equal(board.night.endsAt, at(360).toISOString())
  })

  test('an earlier end beats the six hours', ({ assert }) => {
    const ended = night({ endedAt: at(90) })
    assert.equal(nightEndsAt(ended).toISOString(), at(90).toISOString())

    const board = fearlessBoard(ended, [game(1, 0, [player('A', 1)]), game(2, 100, [player('B', 2)])], [], at(200))
    assert.deepEqual(burnedIds(board), [1])
    assert.isFalse(board.night.active)
  })

  test('is active until its end', ({ assert }) => {
    assert.isTrue(fearlessBoard(night(), [], [], at(359)).night.active)
    assert.isFalse(fearlessBoard(night(), [], [], at(360)).night.active)
  })

  test('an excluded game burns nothing, keeps its row, and loses its number', ({ assert }) => {
    const board = fearlessBoard(
      night({ excludedCustomIds: [1] }),
      [game(1, 0, [player('A', 1)]), game(2, 40, [player('B', 2)])],
      [],
      at(120)
    )
    assert.deepEqual(burnedIds(board), [2])
    assert.deepEqual(
      board.games.map((row) => [row.id, row.number, row.excluded]),
      [
        [1, null, true],
        [2, 1, false],
      ]
    )
  })

  test('numbers games in the order they ended', ({ assert }) => {
    const board = fearlessBoard(night(), [game(2, 40, [player('B', 2)]), game(1, 0, [player('A', 1)])], [], at(120))
    assert.deepEqual(board.games.map((row) => [row.id, row.number]), [
      [1, 1],
      [2, 2],
    ])
  })

  test('a manual burn burns a champion nobody played', ({ assert }) => {
    const board = fearlessBoard(night(), [], [{ championId: 7, kind: 'burn', decidedAt: at(5) }], at(10))
    assert.deepEqual(board.burned, [{ championId: 7, source: 'manual', by: [] }])
  })

  test('freeing forgives earlier picks only', ({ assert }) => {
    const games = [game(1, 0, [player('A', 1)])]
    const freed = fearlessBoard(night(), games, [{ championId: 1, kind: 'free', decidedAt: at(45) }], at(50))
    assert.deepEqual(freed.burned, [])
    assert.deepEqual(freed.freed, [1])

    // Played again in a game that ended after the free: burned again.
    const replayed = fearlessBoard(
      night(),
      [...games, game(2, 50, [player('B', 1)])],
      [{ championId: 1, kind: 'free', decidedAt: at(45) }],
      at(90)
    )
    assert.deepEqual(burnedIds(replayed), [1])
    assert.deepEqual(replayed.burned[0].by, [{ playerName: 'B', memberSlug: null, gameNumber: 2 }])
    assert.deepEqual(replayed.freed, [])
  })

  test('ignores a champion the site could not identify', ({ assert }) => {
    const board = fearlessBoard(night(), [game(1, 0, [player('A', 0)])], [], at(60))
    assert.deepEqual(board.burned, [])
    assert.lengthOf(board.games[0].picks, 1)
  })
})
