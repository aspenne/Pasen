import { describe, expect, it } from 'vitest'

import type { RouletteCard, RouletteView } from '@/lib/api'
import { ladderPoints, laneGap, pointsLabel, teamAverage } from '@/lib/ladder'

function card(tier: string | null, rank: string | null, lp: number | null): RouletteCard {
  return { slug: 's', displayName: 'x', tag: null, tier, rank, leaguePoints: lp, winRate: 50, games: 10, championId: null, championName: null }
}

describe('ladderPoints', () => {
  it('puts every rank on one scale, a hundred points a division', () => {
    expect(ladderPoints(card('IRON', 'IV', 0))).toBe(0)
    expect(ladderPoints(card('BRONZE', 'IV', 20))).toBe(420)
    expect(ladderPoints(card('GOLD', 'I', 99))).toBe(1599)
    expect(ladderPoints(card('DIAMOND', 'I', 99))).toBe(2799)
  })

  it('counts the apex tiers from the bottom of Master', () => {
    expect(ladderPoints(card('MASTER', 'I', 0))).toBe(2800)
    expect(ladderPoints(card('GRANDMASTER', 'I', 650))).toBe(3450)
    expect(ladderPoints(card('CHALLENGER', 'I', 1200))).toBe(4000)
  })

  it('has nothing for an unranked player or no card at all', () => {
    expect(ladderPoints(card(null, null, null))).toBeNull()
    expect(ladderPoints(undefined)).toBeNull()
  })
})

describe('pointsLabel', () => {
  it('reads a point back as a rank', () => {
    expect(pointsLabel(2140)).toBe('Emerald III · 40 LP')
    expect(pointsLabel(3450)).toBe('Master · 650 LP')
    expect(pointsLabel(0)).toBe('Iron IV · 0 LP')
  })
})

const seat = (puuid: string) => ({ puuid, name: puuid, bot: false })
const cards: Record<string, RouletteCard> = {
  a: card('MASTER', 'I', 435),
  b: card('DIAMOND', 'II', 0),
  c: card('EMERALD', 'I', 0),
  r: card('DIAMOND', 'IV', 0),
}
const view: RouletteView = {
  serverTime: '',
  lobby: {
    id: 1,
    source: 'capture',
    updatedAt: '',
    stale: false,
    teams: { blue: [seat('a'), seat('b'), seat('guest')], red: [seat('r'), seat('c'), { puuid: null, name: 'Bot', bot: true }] },
  },
  draw: { id: 1, revealAt: '', roles: { blue: [0, 1, 2, null, null], red: [0, 2, 1, null, null] } },
}

describe('laneGap', () => {
  it('compares the two players of a lane, from each side', () => {
    // Top: Master 435 (3235) against Diamond IV 0 (2400).
    expect(laneGap(view, cards, 0)).toEqual({ blue: 835, red: -835 })
  })

  it('has no gap when either player has no rank, or the lane is empty', () => {
    expect(laneGap(view, cards, 1)).toBeNull()
    expect(laneGap(view, cards, 4)).toBeNull()
  })
})

describe('teamAverage', () => {
  it('averages the ranked players of a side, saying how many that is', () => {
    expect(teamAverage(view.lobby!.teams.blue, cards)).toEqual({ points: 2918, ranked: 2, size: 3 })
    expect(teamAverage([seat('guest')], cards)).toEqual({ points: null, ranked: 0, size: 1 })
  })
})
