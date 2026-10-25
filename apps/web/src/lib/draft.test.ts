import { describe, expect, it } from 'vitest'
import type { DraftAction } from '@pasen/shared'

import { bansOf, lockError, picksByRole, previewLane, seatStillHeld, secondsLeft, turnLabel } from '@/lib/draft'

const actions: DraftAction[] = [
  { step: 0, side: 'blue', kind: 'ban', championId: 10, role: null },
  { step: 1, side: 'red', kind: 'ban', championId: 11, role: null },
  { step: 6, side: 'blue', kind: 'pick', championId: 20, role: 'MIDDLE' },
  { step: 7, side: 'red', kind: 'pick', championId: 21, role: 'TOP' },
]

describe('secondsLeft', () => {
  const started = '2026-10-25T20:00:00.000Z'
  const at = (s: number) => Date.parse(started) + s * 1000

  it('counts thirty seconds down from the start of the turn, on the server clock', () => {
    expect(secondsLeft(started, 0, at(0))).toBe(30)
    expect(secondsLeft(started, 0, at(12.2))).toBe(18)
    expect(secondsLeft(started, 2000, at(12.2))).toBe(16)
  })

  it('stops at zero: the timer only shows', () => {
    expect(secondsLeft(started, 0, at(95))).toBe(0)
  })
})

describe('picksByRole', () => {
  it("lays a side's picks out lane by lane", () => {
    expect(picksByRole(actions, 'blue')).toEqual({ TOP: null, JUNGLE: null, MIDDLE: 20, BOTTOM: null, UTILITY: null })
    expect(picksByRole(actions, 'red').TOP).toBe(21)
  })
})

describe('bansOf', () => {
  it("lists a side's bans in order, padded to five", () => {
    expect(bansOf(actions, 'blue')).toEqual([10, null, null, null, null])
  })
})

describe('turnLabel', () => {
  it('says who is doing what', () => {
    expect(turnLabel({ step: 6, side: 'blue', kind: 'pick' })).toBe('Blue picking')
    expect(turnLabel({ step: 1, side: 'red', kind: 'ban' })).toBe('Red banning')
    expect(turnLabel(null)).toBe('Draft complete')
  })
})

describe('seatStillHeld', () => {
  it("forgets a seat the admin freed, or that nobody holds any more", () => {
    expect(seatStillHeld({ side: 'blue' }, { seats: { blue: true, red: false } })).toBe(true)
    expect(seatStillHeld({ side: 'blue' }, { seats: { blue: false, red: false } })).toBe(false)
    expect(seatStillHeld(null, { seats: { blue: true, red: true } })).toBe(false)
  })
})

describe('lockError', () => {
  it('says why a lock was refused', () => {
    expect(lockError(409)).toBe('Someone was quicker. The draft has moved on.')
    expect(lockError(401)).toBe('Your seat was freed. Take it again to keep playing.')
    expect(lockError(422)).toBe('That champion is banned, picked or burned, or that lane is taken.')
    expect(lockError(403)).toBe('It is not your turn.')
  })
})

describe('previewLane', () => {
  it("shows the hovered champion in the lane it would take: its own if free, else the next free one", () => {
    expect(previewLane(actions, 'blue', ['MIDDLE', 'UTILITY'])).toBe('UTILITY')
    expect(previewLane(actions, 'red', ['MIDDLE'])).toBe('MIDDLE')
    expect(previewLane(actions, 'red', [])).toBe('JUNGLE')
  })
})
