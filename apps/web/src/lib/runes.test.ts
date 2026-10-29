import { describe, expect, it } from 'vitest'

import { runePage } from '@/lib/runes'

const perks = {
  statPerks: { offense: 5008, flex: 5008, defense: 5011 },
  styles: [
    { style: 8000, selections: [{ perk: 8010 }, { perk: 9111 }, { perk: 9104 }, { perk: 8299 }] },
    { style: 8400, selections: [{ perk: 8444 }, { perk: 8451 }] },
  ],
}

describe('runePage', () => {
  it('splits a Riot rune page into its two trees and its shards', () => {
    expect(runePage(perks)).toEqual({
      primary: { style: 8000, perks: [8010, 9111, 9104, 8299] },
      secondary: { style: 8400, perks: [8444, 8451] },
      shards: ['Adaptive Force', 'Adaptive Force', 'Health'],
    })
  })

  it('has nothing for an Arena or bot game, which comes with every id zeroed', () => {
    expect(runePage({ styles: [{ style: 0, selections: [] }, { style: 0, selections: [] }] })).toBeNull()
    expect(runePage(null)).toBeNull()
  })
})
