import type { RouletteCard, RouletteSeat, RouletteView } from '@/lib/api'
import { ladderPoints } from '@pasen/shared'

// The scale lives in @pasen/shared, so the API's LES board counts exactly as the roulette does.
export { ladderPoints, pointsLabel } from '@pasen/shared'

/** The LP between the two players of a lane, seen from each side; null when either has no rank. */
export function laneGap(
  view: RouletteView,
  cards: Record<string, RouletteCard>,
  lane: number
): { blue: number; red: number } | null {
  if (!view.lobby || !view.draw) return null
  const pointsOf = (side: 'blue' | 'red') => {
    const index = view.draw!.roles[side][lane]
    const seat = index === null || index === undefined ? undefined : view.lobby!.teams[side][index]
    return seat?.puuid ? ladderPoints(cards[seat.puuid]) : null
  }
  const blue = pointsOf('blue')
  const red = pointsOf('red')
  if (blue === null || red === null) return null
  return { blue: blue - red, red: red - blue }
}

/**
 * A side's average rank, over the players who have one: a guest, a bot or an
 * unranked player would drag a sum down for no reason, so they are left out
 * and the count says how many the average is about.
 */
export function teamAverage(
  seats: RouletteSeat[],
  cards: Record<string, RouletteCard>
): { points: number | null; ranked: number; size: number } {
  const known = seats
    .map((seat) => (seat.puuid ? ladderPoints(cards[seat.puuid]) : null))
    .filter((points): points is number => points !== null)
  return {
    points: known.length ? Math.round(known.reduce((sum, p) => sum + p, 0) / known.length) : null,
    ranked: known.length,
    size: seats.length,
  }
}

/** "+635" / "−635", with a real minus sign. */
export function signed(points: number): string {
  return points > 0 ? `+${points}` : points < 0 ? `−${Math.abs(points)}` : '±0'
}
