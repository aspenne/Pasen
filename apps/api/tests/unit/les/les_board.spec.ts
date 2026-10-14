import { test } from '@japa/runner'

import { LES_EVENT, lesBoard, type LesAccount, type LesReading } from '#les/les_board'

const START = LES_EVENT.startsAt.getTime()
const day = 86_400_000
const at = (days: number) => new Date(START + days * day)

function account(id: number, slug = `m${id}`): LesAccount {
  return { id, memberSlug: slug, displayName: slug, riotId: `${slug}#EUW`, profileIconId: 1 }
}

function reading(accountId: number, when: Date, tier: string | null, rank: string | null, lp: number, wins: number, losses: number): LesReading {
  return { accountId, capturedAt: when, tier, rank, leaguePoints: lp, wins, losses }
}

test.group('lesBoard', () => {
  test('counts the LP and games since the start, from the last reading before it', ({ assert }) => {
    const board = lesBoard(
      [account(1)],
      [
        reading(1, at(-3), 'DIAMOND', 'II', 10, 100, 90),
        reading(1, at(-0.1), 'DIAMOND', 'II', 50, 101, 90),
        reading(1, at(5), 'DIAMOND', 'I', 20, 110, 95),
      ],
      at(10)
    )
    const [entry] = board.entries
    // Diamond II 50 (2650) to Diamond I 20 (2720).
    assert.equal(entry.lpGained, 70)
    assert.equal(entry.games, 14)
    assert.equal(entry.wins, 9)
    assert.equal(entry.losses, 5)
    assert.isNull(entry.since)
    assert.deepEqual(entry.start, { tier: 'DIAMOND', rank: 'II', leaguePoints: 50 })
  })

  test('a promotion to Master is worth its LP, not a reset', ({ assert }) => {
    const board = lesBoard(
      [account(1)],
      [reading(1, at(-1), 'DIAMOND', 'I', 80, 10, 10), reading(1, at(3), 'MASTER', 'I', 45, 20, 12)],
      at(4)
    )
    assert.equal(board.entries[0].lpGained, 65)
  })

  test('counts a loss of LP as negative', ({ assert }) => {
    const board = lesBoard(
      [account(1)],
      [reading(1, at(-1), 'EMERALD', 'III', 40, 10, 10), reading(1, at(3), 'EMERALD', 'IV', 60, 10, 13)],
      at(4)
    )
    assert.equal(board.entries[0].lpGained, -80)
  })

  test('starts an account added later from its first reading, and says so', ({ assert }) => {
    const board = lesBoard(
      [account(1)],
      [reading(1, at(5), 'GOLD', 'I', 0, 50, 50), reading(1, at(8), 'PLATINUM', 'IV', 10, 55, 51)],
      at(9)
    )
    assert.equal(board.entries[0].lpGained, 110)
    assert.equal(board.entries[0].since, at(5).toISOString())
  })

  test('freezes at the end of the event', ({ assert }) => {
    const end = LES_EVENT.endsAt.getTime()
    const board = lesBoard(
      [account(1)],
      [
        reading(1, at(-1), 'GOLD', 'I', 0, 0, 0),
        reading(1, new Date(end - day), 'GOLD', 'I', 50, 5, 0),
        reading(1, new Date(end + day), 'PLATINUM', 'IV', 0, 9, 0),
      ],
      new Date(end + 2 * day)
    )
    assert.equal(board.entries[0].lpGained, 50)
    assert.equal(board.entries[0].games, 5)
    assert.isTrue(board.event.finished)
  })

  test('lists a never-ranked account with nothing, at the bottom', ({ assert }) => {
    const board = lesBoard(
      [account(1, 'zed'), account(2, 'amy')],
      [reading(2, at(-1), 'SILVER', 'II', 0, 1, 1), reading(2, at(2), 'SILVER', 'II', 0, 3, 3)],
      at(3)
    )
    assert.deepEqual(
      board.entries.map((e) => [e.memberSlug, e.lpGained, e.games, e.current]),
      [
        ['amy', 0, 4, { tier: 'SILVER', rank: 'II', leaguePoints: 0 }],
        ['zed', 0, 0, null],
      ]
    )
  })

  test('sorts by LP, then games, then name, and adds up the group', ({ assert }) => {
    const board = lesBoard(
      [account(1, 'a'), account(2, 'b'), account(3, 'c')],
      [
        reading(1, at(-1), 'GOLD', 'I', 0, 0, 0), reading(1, at(2), 'GOLD', 'I', 30, 2, 1),
        reading(2, at(-1), 'GOLD', 'I', 0, 0, 0), reading(2, at(2), 'GOLD', 'I', 30, 5, 5),
        reading(3, at(-1), 'GOLD', 'I', 50, 0, 0), reading(3, at(2), 'GOLD', 'I', 0, 0, 3),
      ],
      at(3)
    )
    assert.deepEqual(board.entries.map((e) => e.memberSlug), ['b', 'a', 'c'])
    assert.deepEqual(board.totals, { lpGained: 10, games: 16, activeAccounts: 3, accounts: 3 })
  })

  test("tags each account with its member's LAN team, and sums each team", ({ assert }) => {
    const board = lesBoard(
      [account(1, 'noah'), account(2, 'noah'), account(3, 'azizes'), account(4, 'chaf')],
      [
        reading(1, at(-1), 'MASTER', 'I', 100, 0, 0), reading(1, at(2), 'MASTER', 'I', 300, 6, 2),
        reading(2, at(-1), 'GOLD', 'I', 0, 0, 0), reading(2, at(2), 'GOLD', 'I', 0, 1, 1),
        reading(3, at(-1), 'DIAMOND', 'II', 50, 0, 0), reading(3, at(2), 'DIAMOND', 'II', 0, 1, 2),
        reading(4, at(-1), 'EMERALD', 'IV', 0, 0, 0), reading(4, at(2), 'EMERALD', 'IV', 90, 4, 0),
      ],
      at(3)
    )
    const teamOf = Object.fromEntries(board.entries.map((e) => [`${e.memberSlug}-${e.games}`, e.team]))
    assert.equal(teamOf['noah-8'], 'honest')
    assert.equal(teamOf['noah-2'], 'honest')
    assert.equal(teamOf['azizes-3'], 'hungry')
    assert.isNull(teamOf['chaf-4'])
    assert.deepEqual(board.teams, [
      { key: 'honest', name: 'Honnêtes & Gourmets', lpGained: 200, games: 10, activeAccounts: 2, accounts: 2 },
      { key: 'hungry', name: 'Malhonnêtes & Affamés', lpGained: -50, games: 3, activeAccounts: 1, accounts: 1 },
    ])
  })
})
