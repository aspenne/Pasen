import { describe, expect, it } from 'vitest'

import { decayRuleFor, simulateBank, type DecayDay } from './decay.js'

/** A run of consecutive days, so a test reads as a story rather than a table. */
function days(from: string, counts: number[]): DecayDay[] {
  const out: DecayDay[] = []
  let cursor = new Date(`${from}T00:00:00Z`)
  for (const games of counts) {
    out.push({ day: cursor.toISOString().slice(0, 10), games })
    cursor = new Date(cursor.getTime() + 86_400_000)
  }
  return out
}

const last = (list: DecayDay[]) => list[list.length - 1].day

describe('decayRuleFor', () => {
  it('leaves Emerald and below alone', () => {
    expect(decayRuleFor('EMERALD')).toBeNull()
    expect(decayRuleFor('PLATINUM')).toBeNull()
    expect(decayRuleFor('IRON')).toBeNull()
    expect(decayRuleFor(null)).toBeNull()
  })

  it('banks seven days a game in Diamond and one above it', () => {
    expect(decayRuleFor('DIAMOND')).toEqual({ cap: 28, perGame: 7, lpPerDay: 50 })
    expect(decayRuleFor('MASTER')).toEqual({ cap: 14, perGame: 1, lpPerDay: 75 })
    expect(decayRuleFor('grandmaster')).toEqual(decayRuleFor('MASTER'))
    expect(decayRuleFor('CHALLENGER')).toEqual(decayRuleFor('MASTER'))
  })
})

describe('simulateBank', () => {
  const master = decayRuleFor('MASTER')!
  const diamond = decayRuleFor('DIAMOND')!

  it('spends one day of the bank for every day not played', () => {
    const history = days('2026-09-01', [5, 0, 0, 0])
    expect(simulateBank(history, master, last(history)).daysLeft).toBe(11)
  })

  it('never banks past the cap, however many games are played', () => {
    const history = days('2026-09-01', [60])
    expect(simulateBank(history, master, last(history)).daysLeft).toBe(master.cap)
  })

  it('reports zero rather than a negative bank once decay has started', () => {
    const history = [...days('2026-09-01', [1]), { day: '2026-11-01', games: 0 }]
    const state = simulateBank(history, master, '2026-11-01')
    expect(state.daysLeft).toBe(0)
    expect(state.lpPerDay).toBe(75)
  })

  it('climbs back out of decay at one day per game in apex', () => {
    // Empty by the 20th, then three games on the same evening.
    const history = [...days('2026-09-01', [1]), { day: '2026-09-30', games: 3 }]
    expect(simulateBank(history, master, '2026-09-30').daysLeft).toBe(3)
  })

  it('refills Diamond in four games where apex needs fourteen', () => {
    const history = [...days('2026-09-01', [1]), { day: '2026-11-01', games: 4 }]
    expect(simulateBank(history, diamond, '2026-11-01').daysLeft).toBe(diamond.cap)
  })

  /*
   * The honesty check. The starting bank is an assumption, and the flag is the
   * only thing telling a reader whether the number is history or that guess.
   */
  it('is not confident until the cap has actually been refilled', () => {
    const thin = [...days('2026-09-01', [1]), { day: '2026-09-25', games: 2 }]
    expect(simulateBank(thin, master, '2026-09-25').confident).toBe(false)

    const full = days('2026-09-01', Array.from({ length: 20 }, () => 2))
    expect(simulateBank(full, master, last(full)).confident).toBe(true)
  })

  it('has nothing to say when no ranked game has ever been seen', () => {
    expect(simulateBank([], master, '2026-09-01')).toEqual({
      daysLeft: 0,
      confident: false,
      cap: 14,
      lpPerDay: 75,
    })
  })

  it('crosses a month boundary without losing a day', () => {
    const history = [{ day: '2026-09-28', games: 14 }]
    expect(simulateBank(history, master, '2026-10-03').daysLeft).toBe(9)
  })
})
