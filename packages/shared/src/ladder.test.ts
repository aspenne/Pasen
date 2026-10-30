import { describe, expect, it } from 'vitest'

import { ladderPoints, lpOverGames, pointsLabel } from './ladder.js'

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

describe('lpOverGames', () => {
  const at = (hour: number) => new Date(Date.UTC(2026, 9, 30) + hour * 3_600_000)
  const reading = (hour: number, tier: string | null, rank: string | null, leaguePoints: number, queueType = 'RANKED_SOLO_5x5', accountId = 1) => ({
    accountId,
    queueType,
    capturedAt: at(hour),
    tier,
    rank,
    leaguePoints,
  })
  const game = (hour: number, queueType = 'RANKED_SOLO_5x5', accountId = 1) => ({ accountId, queueType, startedAt: at(hour) })

  it('measures from the last reading before the first game to the latest, promotions included', () => {
    const readings = [reading(2, 'GOLD', 'I', 80), reading(10, 'GOLD', 'I', 99), reading(12, 'PLATINUM', 'IV', 15)]
    expect(lpOverGames(readings, [game(9), game(11)]).get(1)).toBe(35)
  })

  it('counts what the ladder shows, so a refunded loss costs nothing', () => {
    // Won 20, lost a game a leaver made Riot refund: the standing never dropped.
    const readings = [reading(2, 'GOLD', 'II', 40), reading(10, 'GOLD', 'II', 60), reading(11, 'GOLD', 'II', 60)]
    expect(lpOverGames(readings, [game(9), game(10.5)]).get(1)).toBe(20)
  })

  it('leaves the night before out, however late its reading came', () => {
    // A loss at 23:00 the day before, read at 01:00; the day itself lost 20 and won 18.
    const readings = [reading(-5, 'GOLD', 'II', 49), reading(1, 'GOLD', 'II', 28), reading(15, 'GOLD', 'II', 8), reading(16, 'GOLD', 'II', 26)]
    expect(lpOverGames(readings, [game(14), game(15.5)]).get(1)).toBe(-2)
  })

  it('stops at the next game, and keeps a refund that lands before it', () => {
    // Lost 22 at 21:00, refunded at 23:30, then played again the next day.
    const readings = [reading(20, 'GOLD', 'II', 50), reading(22, 'GOLD', 'II', 28), reading(23.5, 'GOLD', 'II', 50), reading(26, 'GOLD', 'II', 70)]
    expect(lpOverGames(readings, [game(21)], [game(25)]).get(1)).toBe(0)
  })

  it('leaves out a ladder the account did not play on', () => {
    const readings = [reading(2, 'GOLD', 'II', 40), reading(10, 'GOLD', 'II', 20), reading(1, 'SILVER', 'I', 10, 'RANKED_FLEX_SR'), reading(12, 'SILVER', 'I', 0, 'RANKED_FLEX_SR')]
    expect(lpOverGames(readings, [game(9)]).get(1)).toBe(-20)
    expect(lpOverGames(readings, []).has(1)).toBe(false)
  })

  it('starts an account first seen after its first game at that first reading', () => {
    expect(lpOverGames([reading(9, 'SILVER', 'I', 10), reading(11, 'SILVER', 'I', 30)], [game(8), game(10)]).get(1)).toBe(20)
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
    const games = [game(9), game(11, 'RANKED_FLEX_SR'), game(11, 'RANKED_TFT')]
    expect(lpOverGames(readings, games).get(1)).toBe(-5)
  })
})
