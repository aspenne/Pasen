import { describe, expect, it } from 'vitest'

import { withinWindow } from '@/components/charts/LpCurve'
import type { LpPoint } from '@/lib/api'

const DAY = 86_400_000

function point(daysAgo: number, leaguePoints: number): LpPoint {
  return {
    capturedAt: new Date(Date.now() - daysAgo * DAY).toISOString(),
    tier: 'MASTER',
    rank: 'I',
    leaguePoints,
    wins: 0,
    losses: 0,
  }
}

describe('withinWindow', () => {
  it('keeps every snapshot when no window is asked for', () => {
    const points = [point(40, 700), point(10, 750), point(1, 800)]
    expect(withinWindow(points, null)).toEqual(points)
  })

  it('drops snapshots older than the window', () => {
    const points = [point(40, 700), point(10, 750), point(2, 800)]
    const kept = withinWindow(points, 7)

    // The one inside, preceded by the standing carried to the window's edge.
    expect(kept).toHaveLength(2)
    expect(kept[1].leaguePoints).toBe(800)
  })

  it('carries the last standing before the window to its edge', () => {
    const points = [point(40, 700), point(10, 750), point(2, 800)]
    const [edge] = withinWindow(points, 7)

    expect(edge.leaguePoints).toBe(750)
    const cutoff = Date.now() - 7 * DAY
    expect(Math.abs(new Date(edge.capturedAt).getTime() - cutoff)).toBeLessThan(2000)
  })

  it('draws a flat line when nothing was recorded in the window', () => {
    // A rank is written down only when it moves, so silence means it held.
    const points = [point(40, 700), point(20, 900)]
    const kept = withinWindow(points, 7)

    expect(kept).toHaveLength(1)
    expect(kept[0].leaguePoints).toBe(900)
  })

  it('returns nothing when there is nothing at all', () => {
    expect(withinWindow([], 7)).toEqual([])
  })

  it('keeps everything when the window is wider than the history', () => {
    const points = [point(3, 700), point(1, 720)]
    expect(withinWindow(points, 30)).toEqual(points)
  })
})
