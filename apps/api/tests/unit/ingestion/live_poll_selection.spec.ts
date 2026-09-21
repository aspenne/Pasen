import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import {
  COLD_CYCLES,
  HOT_WINDOW_HOURS,
  selectLivePollTargets,
} from '#ingestion/live_poll_selection'

const NOW = DateTime.fromISO('2026-09-21T20:00:00Z', { zone: 'utc' })

function account(id: number, lastSeenLiveAt: DateTime | null = null) {
  return { id, lastSeenLiveAt }
}

test.group('selectLivePollTargets', () => {
  test('always polls someone currently in a game', ({ assert }) => {
    // Cold by every other measure, and on a cycle that is not this one.
    const inGame = account(COLD_CYCLES * 3 + ((Math.floor(NOW.toSeconds() / 60) + 1) % COLD_CYCLES), NOW)
    const picked = selectLivePollTargets([inGame], new Map(), NOW)

    assert.lengthOf(picked, 1, 'the end of a game has to be noticed promptly')
  })

  test('always polls someone who played within the hot window', ({ assert }) => {
    const recent = account(1)
    const played = new Map([[1, NOW.minus({ hours: HOT_WINDOW_HOURS - 1 })]])

    assert.lengthOf(selectLivePollTargets([recent], played, NOW), 1)
  })

  test('lets an account go cold once it is outside the window', ({ assert }) => {
    const stale = new Map([[7, NOW.minus({ hours: HOT_WINDOW_HOURS + 1 })]])
    const cycle = Math.floor(NOW.toSeconds() / 60) % COLD_CYCLES
    // An id deliberately on a different cycle from this minute.
    const id = cycle === 0 ? 1 : 0

    assert.lengthOf(selectLivePollTargets([account(id)], stale, NOW), 0)
  })

  test('reaches every cold account across one rotation', ({ assert }) => {
    const accounts = Array.from({ length: 25 }, (_, i) => account(i + 1))
    const seen = new Set<number>()

    for (let minute = 0; minute < COLD_CYCLES; minute++) {
      for (const picked of selectLivePollTargets(accounts, new Map(), NOW.plus({ minutes: minute }))) {
        seen.add(picked.id)
      }
    }

    assert.equal(seen.size, accounts.length, 'nobody may be left unpolled forever')
  })

  test('costs a fraction of polling everyone', ({ assert }) => {
    const accounts = Array.from({ length: 25 }, (_, i) => account(i + 1))
    // Nine played recently, which is what a real evening looks like here.
    const played = new Map(
      Array.from({ length: 9 }, (_, i) => [i + 1, NOW.minus({ hours: 1 })] as const)
    )

    const picked = selectLivePollTargets(accounts, new Map(played), NOW)

    assert.isAtLeast(picked.length, 9, 'the recent players are always in')
    assert.isBelow(picked.length, accounts.length, 'and the dormant ones are not, every minute')
  })
})
