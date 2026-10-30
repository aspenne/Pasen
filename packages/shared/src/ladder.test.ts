import { describe, expect, it } from 'vitest'

import { ladderPoints, lpBetween, pointsLabel } from './ladder.js'

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

describe('lpBetween', () => {
  const at = (hour: number) => new Date(Date.UTC(2026, 9, 30) + hour * 3_600_000)
  const reading = (hour: number, tier: string | null, rank: string | null, leaguePoints: number, queueType = 'RANKED_SOLO_5x5', accountId = 1) => ({
    accountId,
    queueType,
    capturedAt: at(hour),
    tier,
    rank,
    leaguePoints,
  })
  const from = at(6)
  const to = at(23)

  it('measures from the last reading before the window to the last inside it, promotions included', () => {
    const readings = [reading(2, 'GOLD', 'I', 80), reading(10, 'GOLD', 'I', 99), reading(12, 'PLATINUM', 'IV', 15)]
    expect(lpBetween(readings, from, to).get(1)).toBe(35)
  })

  it('counts what the ladder shows, so a refunded loss costs nothing', () => {
    // Won 20, lost a game a leaver made Riot refund: the standing never dropped.
    const readings = [reading(2, 'GOLD', 'II', 40), reading(10, 'GOLD', 'II', 60), reading(11, 'GOLD', 'II', 60)]
    expect(lpBetween(readings, from, to).get(1)).toBe(20)
  })

  it('ignores readings after the window and accounts that did not move in it', () => {
    const readings = [reading(2, 'GOLD', 'II', 40), reading(23.5, 'GOLD', 'II', 90), reading(1, 'SILVER', 'I', 10, 'RANKED_SOLO_5x5', 2)]
    const gained = lpBetween(readings, from, to)
    expect(gained.has(1)).toBe(false)
    expect(gained.has(2)).toBe(false)
  })

  it('starts an account first seen inside the window at that first reading', () => {
    expect(lpBetween([reading(9, 'SILVER', 'I', 10), reading(11, 'SILVER', 'I', 30)], from, to).get(1)).toBe(20)
  })

  it('adds up an account’s queues, and skips one with no rank to measure', () => {
    const readings = [
      reading(2, 'GOLD', 'II', 40),
      reading(10, 'GOLD', 'II', 15),
      reading(2, 'SILVER', 'III', 50, 'RANKED_FLEX_SR'),
      reading(12, 'SILVER', 'III', 70, 'RANKED_FLEX_SR'),
      reading(2, null, null, 0, 'RANKED_TFT'),
      reading(12, 'IRON', 'IV', 0, 'RANKED_TFT'),
    ]
    expect(lpBetween(readings, from, to).get(1)).toBe(-5)
  })
})
