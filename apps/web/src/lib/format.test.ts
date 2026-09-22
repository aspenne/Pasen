import { describe, expect, it } from 'vitest'

import { rankedQueueFor, rankScore } from '@/lib/format'

const at = (tier: string | null, division: string | null, leaguePoints: number) => ({
  tier,
  rank: division,
  leaguePoints,
})

describe('rankScore', () => {
  it('orders the tiers', () => {
    expect(rankScore(at('GOLD', 'IV', 0))).toBeGreaterThan(rankScore(at('SILVER', 'I', 100)))
    expect(rankScore(at('EMERALD', 'IV', 0))).toBeGreaterThan(rankScore(at('PLATINUM', 'I', 100)))
  })

  it('orders the divisions within a tier', () => {
    expect(rankScore(at('GOLD', 'I', 0))).toBeGreaterThan(rankScore(at('GOLD', 'IV', 99)))
  })

  it('separates two players in the same division by their points', () => {
    expect(rankScore(at('GOLD', 'II', 74))).toBeGreaterThan(rankScore(at('GOLD', 'II', 12)))
  })

  it('ranks the apex tiers on points alone', () => {
    // Grandmaster begins wherever the 700th player sits, so its division is
    // meaningless and a Master on 1311 really is above a Master on 48.
    expect(rankScore(at('MASTER', 'I', 1311))).toBeGreaterThan(rankScore(at('MASTER', 'I', 48)))
    expect(rankScore(at('MASTER', 'I', 0))).toBeGreaterThan(rankScore(at('DIAMOND', 'I', 100)))
  })

  it('sorts the unranked below Iron rather than beside it', () => {
    expect(rankScore(null)).toBeLessThan(rankScore(at('IRON', 'IV', 0)))
    expect(rankScore(at(null, null, 0))).toBe(-1)
  })

  it('puts the real roster in the right order', () => {
    const roster = [
      { name: 'visage insolite', rank: at('SILVER', 'II', 82) },
      { name: 'MATIOU GOAT', rank: at('MASTER', 'I', 1311) },
      { name: 'LORIS LA MALICE', rank: at('EMERALD', 'III', 95) },
      { name: 'Azizes', rank: at('DIAMOND', 'II', 48) },
      { name: 'le facteur', rank: null },
    ]

    expect(
      [...roster].sort((a, b) => rankScore(b.rank) - rankScore(a.rank)).map((e) => e.name)
    ).toEqual([
      'MATIOU GOAT',
      'Azizes',
      'LORIS LA MALICE',
      'visage insolite',
      'le facteur',
    ])
  })
})

describe('rankedQueueFor', () => {
  it('names the ladder a ranked scope is about', () => {
    expect(rankedQueueFor('ranked_solo')).toBe('RANKED_SOLO_5x5')
    expect(rankedQueueFor('ranked_flex')).toBe('RANKED_FLEX_SR')
  })

  it('falls back to solo where a scope covers no ladder', () => {
    // Rift, normals, ARAM, Arena and "all" span queues with no ladder between
    // them; ordering by one that does not cover them would invent a standing.
    for (const scope of ['rift', 'normal', 'clash', 'aram', 'arena', 'all']) {
      expect(rankedQueueFor(scope)).toBe('RANKED_SOLO_5x5')
    }
  })
})
