import { describe, expect, it } from 'vitest'

import { ladderPoints, pointsLabel } from './ladder.js'

const r = (tier: string | null, rank: string | null, leaguePoints: number) => ({ tier, rank, leaguePoints })

describe('ladderPoints', () => {
  it('puts every rank on one scale, a hundred points a division', () => {
    expect(ladderPoints(r('IRON', 'IV', 0))).toBe(0)
    expect(ladderPoints(r('BRONZE', 'IV', 20))).toBe(420)
    expect(ladderPoints(r('GOLD', 'I', 99))).toBe(1599)
    expect(ladderPoints(r('DIAMOND', 'I', 99))).toBe(2799)
  })

  it('counts the apex tiers from the bottom of Master', () => {
    expect(ladderPoints(r('MASTER', 'I', 0))).toBe(2800)
    expect(ladderPoints(r('GRANDMASTER', 'I', 650))).toBe(3450)
    expect(ladderPoints(r('CHALLENGER', 'I', 1200))).toBe(4000)
  })

  it('has nothing for an unranked player', () => {
    expect(ladderPoints(r(null, null, 0))).toBeNull()
    expect(ladderPoints(null)).toBeNull()
  })
})

describe('pointsLabel', () => {
  it('reads a point back as a rank', () => {
    expect(pointsLabel(2140)).toBe('Emerald III · 40 LP')
    expect(pointsLabel(3450)).toBe('Master · 650 LP')
    expect(pointsLabel(0)).toBe('Iron IV · 0 LP')
  })
})
