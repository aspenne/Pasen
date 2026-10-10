import { describe, expect, it } from 'vitest'

import type { RouletteView } from '@/lib/api'
import { REVEAL_STEP_MS, discordText, holdReveal, revealOrder, revealedCount } from '@/lib/roulette'

const seat = (name: string) => ({ puuid: `p-${name}`, name, bot: false })

const view: RouletteView = {
  serverTime: '2026-10-10T20:00:00.000Z',
  lobby: {
    id: 1,
    source: 'capture',
    updatedAt: '2026-10-10T20:00:00.000Z',
    stale: false,
    teams: { blue: ['A', 'B', 'C', 'D', 'E'].map(seat), red: ['F', 'G', 'H', 'I'].map(seat) },
  },
  draw: {
    id: 1,
    revealAt: '2026-10-10T20:00:02.000Z',
    roles: { blue: [4, 3, 2, 1, 0], red: [0, 1, null, 2, 3] },
  },
}

describe('revealOrder', () => {
  it('alternates the sides, lane by lane', () => {
    expect(revealOrder().slice(0, 4)).toEqual([
      ['blue', 0],
      ['red', 0],
      ['blue', 1],
      ['red', 1],
    ])
    expect(revealOrder()).toHaveLength(10)
  })
})

describe('revealedCount', () => {
  const revealAt = Date.parse('2026-10-10T20:00:02.000Z')

  it('shows nothing before the reveal starts', () => {
    expect(revealedCount(view.draw!.revealAt, 0, revealAt - 1)).toBe(0)
  })

  it('turns one card per step from the reveal time', () => {
    expect(revealedCount(view.draw!.revealAt, 0, revealAt)).toBe(1)
    expect(revealedCount(view.draw!.revealAt, 0, revealAt + REVEAL_STEP_MS * 3)).toBe(4)
    expect(revealedCount(view.draw!.revealAt, 0, revealAt + 60_000)).toBe(10)
  })

  it("follows the server's clock, not this computer's", () => {
    // This PC runs five seconds slow: the server is already 3 s into the reveal.
    expect(revealedCount(view.draw!.revealAt, 5_000, revealAt - 2_000)).toBe(5)
  })
})

describe('discordText', () => {
  it('lists each side by lane, skipping a role nobody drew', () => {
    expect(discordText(view)).toBe(
      ['Blue — Top: E · Jungle: D · Mid: C · Bot: B · Support: A', 'Red — Top: F · Jungle: G · Bot: H · Support: I'].join('\n')
    )
  })
})

describe('holdReveal', () => {
  it('never turns a card back over during a draw, whatever the network jitter', () => {
    expect(holdReveal({ drawId: 1, count: 4 }, 1, 3)).toEqual({ drawId: 1, count: 4 })
    expect(holdReveal({ drawId: 1, count: 4 }, 1, 5)).toEqual({ drawId: 1, count: 5 })
  })

  it('starts again from the new count on a reroll', () => {
    expect(holdReveal({ drawId: 1, count: 10 }, 2, 0)).toEqual({ drawId: 2, count: 0 })
    expect(holdReveal(null, 2, 3)).toEqual({ drawId: 2, count: 3 })
  })
})
