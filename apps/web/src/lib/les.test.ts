import { describe, expect, it } from 'vitest'

import { countdownLabel, sinceLabel } from '@/lib/les'

// 13 Nov 2026, 00:00 in Paris.
const END = '2026-11-12T23:00:00.000Z'
const before = (hours: number) => Date.parse(END) - hours * 3_600_000

describe('countdownLabel', () => {
  it('counts the days left', () => {
    expect(countdownLabel(END, before(24 * 30))).toBe('30 days to go')
    expect(countdownLabel(END, before(30))).toBe('2 days to go')
    expect(countdownLabel(END, before(5))).toBe('1 day to go')
  })

  it('says it is the day, then gives the final standings', () => {
    expect(countdownLabel(END, before(-3))).toBe('LAN day')
    expect(countdownLabel(END, before(-30))).toBe('Final standings')
  })
})

describe('sinceLabel', () => {
  it('says where a late account starts counting', () => {
    expect(sinceLabel('2026-10-06T08:15:00.000Z')).toBe('since added on 6 Oct')
  })
})
