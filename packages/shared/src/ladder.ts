/**
 * Every rank on one scale, so two players - or one player on two dates - can
 * be compared in LP. A division is a hundred points: Iron IV 0 LP is 0,
 * Diamond I 99 LP is 2799. Master, Grandmaster and Challenger share one
 * ladder above that, so all three count up from Master 0 LP, 2800: a
 * promotion to Master is worth its LP, not a reset to zero.
 */
const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND'] as const
const DIVISIONS = ['IV', 'III', 'II', 'I'] as const
const APEX = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER'])
const MASTER = TIERS.length * 400

export type RankReading = { tier: string | null; rank: string | null; leaguePoints: number | null }

export function ladderPoints(reading: RankReading | null | undefined): number | null {
  if (!reading?.tier) return null
  const tier = reading.tier.toUpperCase()
  const lp = reading.leaguePoints ?? 0
  if (APEX.has(tier)) return MASTER + lp
  const t = TIERS.indexOf(tier as (typeof TIERS)[number])
  const d = DIVISIONS.indexOf((reading.rank ?? 'IV') as (typeof DIVISIONS)[number])
  if (t === -1 || d === -1) return null
  return t * 400 + d * 100 + lp
}

/** A point on the scale read back as a rank: "Emerald III · 40 LP". */
export function pointsLabel(points: number): string {
  if (points >= MASTER) return `Master · ${points - MASTER} LP`
  const safe = Math.max(0, points)
  const t = Math.floor(safe / 400)
  const d = Math.floor((safe % 400) / 100)
  const tier = TIERS[t].charAt(0) + TIERS[t].slice(1).toLowerCase()
  return `${tier} ${DIVISIONS[d]} · ${safe % 100} LP`
}
