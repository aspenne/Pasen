import { describe, expect, it } from 'vitest'
import type { DraftAction } from '@pasen/shared'

import { bansOf, picksByRole, secondsLeft, turnLabel } from '@/lib/draft'

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
