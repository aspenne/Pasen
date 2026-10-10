import { test } from '@japa/runner'

import { ROLES, drawRoles } from '#roulette/draw_roles'
import { normaliseTeams, type Teams } from '#roulette/lobby_teams'

function seat(name: string) {
  return { puuid: `puuid-${name}`, name, bot: false }
}

const full: Teams = {
  blue: ['a', 'b', 'c', 'd', 'e'].map(seat),
  red: ['f', 'g', 'h', 'i', 'j'].map(seat),
}

/** A fixed sequence, so a draw can be asserted exactly. */
function sequence(values: number[]) {
  let i = 0
  return () => values[i++ % values.length]
}

test.group('drawRoles', () => {
  test('gives every player one role, each role once per team', ({ assert }) => {
    const draw = drawRoles(full)
    for (const side of ['blue', 'red'] as const) {
      assert.lengthOf(draw[side], ROLES.length)
      assert.sameMembers(draw[side] as number[], [0, 1, 2, 3, 4])
    }
  })

  test('leaves a role empty when a team is short', ({ assert }) => {
    const draw = drawRoles({ blue: full.blue.slice(0, 4), red: [] })
    assert.sameMembers(draw.blue, [0, 1, 2, 3, null])
    assert.deepEqual(draw.red, [null, null, null, null, null])
  })

  test('is decided by the random source alone', ({ assert }) => {
    const a = drawRoles(full, sequence([0.1, 0.7, 0.3, 0.9, 0.5]))
    const b = drawRoles(full, sequence([0.1, 0.7, 0.3, 0.9, 0.5]))
    assert.deepEqual(a, b)
  })
})

test.group('normaliseTeams', () => {
  test('keeps at most five a side, and gives a bot no puuid', ({ assert }) => {
    const teams = normaliseTeams({
      blue: [...['a', 'b', 'c', 'd', 'e', 'f'].map(seat)],
      red: [{ puuid: 'x', name: 'Annie Bot', bot: true }],
    })
    assert.lengthOf(teams.blue, 5)
    assert.deepEqual(teams.red, [{ puuid: null, name: 'Annie Bot', bot: true }])
  })

  test('trims names and refuses a side that is not a list', ({ assert }) => {
    const teams = normaliseTeams({ blue: [{ puuid: 'p', name: `  ${'x'.repeat(60)}  `, bot: false }], red: [] })
    assert.lengthOf(teams.blue[0].name, 40)
    assert.throws(() => normaliseTeams({ blue: 'nope', red: [] }))
    assert.throws(() => normaliseTeams(null))
  })
})
