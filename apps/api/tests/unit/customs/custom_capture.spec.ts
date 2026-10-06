import { test } from '@japa/runner'

import { capturedAtFrom, fingerprintOf } from '#customs/custom_capture_service'

test.group('fingerprintOf', () => {
  /*
   * The capture carries no game id, so the bytes are its identity - and that
   * only holds if key order cannot change the answer. A serialiser that
   * reordered one object would otherwise let the same game in twice.
   */
  test('ignores key order, so the same capture hashes the same', ({ assert }) => {
    const one = { gameData: { gameMode: 'CLASSIC', gameTime: 1200 }, allPlayers: [{ a: 1, b: 2 }] }
    const other = { allPlayers: [{ b: 2, a: 1 }], gameData: { gameTime: 1200, gameMode: 'CLASSIC' } }

    assert.equal(fingerprintOf(one), fingerprintOf(other))
  })

  test('separates two captures that differ by a single score', ({ assert }) => {
    const one = { allPlayers: [{ scores: { kills: 4 } }] }
    const other = { allPlayers: [{ scores: { kills: 5 } }] }

    assert.notEqual(fingerprintOf(one), fingerprintOf(other))
  })

  test('keeps arrays ordered, since player order is part of the game', ({ assert }) => {
    assert.notEqual(fingerprintOf({ p: [1, 2] }), fingerprintOf({ p: [2, 1] }))
  })
})

test.group('capturedAtFrom', () => {
  /*
   * The agent stamps its own filename, and that survives a copy between
   * machines where a modified time sometimes does not.
   */
  test('reads the agent stamp out of the filename first', ({ assert }) => {
    const at = capturedAtFrom('custom-2026-10-05T21-14-07-882Z.json', '2020-01-01T00:00:00Z')

    assert.equal(at.toISO({ suppressMilliseconds: true }), '2026-10-05T21:14:07Z')
  })

  test('falls back to what the browser reported for the file', ({ assert }) => {
    const at = capturedAtFrom('renamed-by-someone.json', '2026-10-05T18:00:00Z')

    assert.equal(at.toISO({ suppressMilliseconds: true }), '2026-10-05T18:00:00Z')
  })

  test('falls back to now rather than refusing a capture over a filename', ({ assert }) => {
    const at = capturedAtFrom(undefined, undefined)

    assert.isTrue(at.isValid)
    assert.isBelow(Math.abs(at.diffNow().as('seconds')), 5)
  })

  test('ignores a filename whose stamp is not a date', ({ assert }) => {
    const at = capturedAtFrom('custom-9999-99-99T99-99-99.json', '2026-10-05T18:00:00Z')

    assert.equal(at.toISO({ suppressMilliseconds: true }), '2026-10-05T18:00:00Z')
  })
})
