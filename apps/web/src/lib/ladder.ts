import type { RouletteCard, RouletteSeat, RouletteView } from '@/lib/api'

/**
 * Every rank on one scale, so two players - or two teams - can be compared in
 * LP. A division is a hundred points: Iron IV 0 LP is 0, Diamond I 99 LP is
 * 2799. Master, Grandmaster and Challenger share one ladder above that, so
 * all three count up from Master 0 LP, 2800.
 */
const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND'] as const
const DIVISIONS = ['IV', 'III', 'II', 'I'] as const
const APEX = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER'])
const MASTER = TIERS.length * 400

export function ladderPoints(card: RouletteCard | undefined): number | null {
  if (!card?.tier) return null
  const tier = card.tier.toUpperCase()
  const lp = card.leaguePoints ?? 0
  if (APEX.has(tier)) return MASTER + lp
  const t = TIERS.indexOf(tier as (typeof TIERS)[number])
  const d = DIVISIONS.indexOf((card.rank ?? 'IV') as (typeof DIVISIONS)[number])
  if (t === -1 || d === -1) return null
  return t * 400 + d * 100 + lp
}

/** A point on the scale read back as a rank: "Emerald III · 40 LP". */
export function pointsLabel(points: number): string {
  if (points >= MASTER) return `Master · ${points - MASTER} LP`
  const t = Math.floor(points / 400)
  const d = Math.floor((points % 400) / 100)
  const tier = TIERS[t].charAt(0) + TIERS[t].slice(1).toLowerCase()
  return `${tier} ${DIVISIONS[d]} · ${points % 100} LP`
}

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
