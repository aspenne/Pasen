import { describe, expect, it } from 'vitest'

import type { LesBoard } from '@/lib/api'
import { countdownLabel, entriesFor, sinceLabel, summarise } from '@/lib/les'

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

const entry = (slug: string, team: 'honest' | 'hungry' | null, lp: number, games: number) =>
  ({ memberSlug: slug, displayName: slug, riotId: `${slug}#1`, profileIconId: null, start: null, current: null, lpGained: lp, games, wins: games, losses: 0, since: null, team }) as LesBoard['entries'][number]

const entries = [entry('noah', 'honest', 300, 10), entry('azizes', 'hungry', -20, 4), entry('chaf', null, 50, 3), entry('koko', 'hungry', 0, 0)]

describe('entriesFor', () => {
  it('keeps the two LAN teams by default, one team, or everyone', () => {
    expect(entriesFor(entries, 'teams').map((e) => e.memberSlug)).toEqual(['noah', 'azizes', 'koko'])
    expect(entriesFor(entries, 'hungry').map((e) => e.memberSlug)).toEqual(['azizes', 'koko'])
    expect(entriesFor(entries, 'everyone')).toHaveLength(4)
  })
})

describe('summarise', () => {
  it('adds up what the shown accounts did', () => {
    expect(summarise(entriesFor(entries, 'teams'))).toEqual({ lpGained: 280, games: 14, activeAccounts: 2, accounts: 3 })
  })
})
