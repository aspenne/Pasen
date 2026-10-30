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
    const page = runePage(perks)
    expect(page?.primary).toEqual({ style: 8000, perks: [8010, 9111, 9104, 8299] })
    expect(page?.secondary).toEqual({ style: 8400, perks: [8444, 8451] })
    expect(page?.shards.map((shard) => shard.name)).toEqual(['Adaptive Force', 'Adaptive Force', 'Health'])
  })

  it('gives each shard its icon, and a nameless slot for one it does not know', () => {
    const page = runePage({ ...perks, statPerks: { offense: 5005, flex: 9999, defense: 5011 } })
    expect(page?.shards).toEqual([
      { id: 5005, name: 'Attack speed', image: 'perk-images/StatMods/StatModsAttackSpeedIcon.png', description: '10% Attack Speed' },
      { id: 9999, name: 'Shard', image: null, description: null },
      { id: 5011, name: 'Health', image: 'perk-images/StatMods/StatModsHealthPlusIcon.png', description: '65 Health' },
    ])
  })

  it('has nothing for an Arena or bot game, which comes with every id zeroed', () => {
    expect(runePage({ styles: [{ style: 0, selections: [] }, { style: 0, selections: [] }] })).toBeNull()
    expect(runePage(null)).toBeNull()
  })
})
