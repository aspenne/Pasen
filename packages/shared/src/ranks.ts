/** Lowest to highest, which is the order every comparison below relies on. */
export const TIER_ORDER = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
] as const

export type Tier = (typeof TIER_ORDER)[number]

const DIVISION_ORDER = ['IV', 'III', 'II', 'I']
/** Clear of Diamond I at a hundred points, which is the highest a division goes. */
const APEX_BASE = 2_900

export type Standing = {
  tier: string | null
  rank: string | null
  leaguePoints: number
}

/**
 * A standing as one number, so two of them can be compared.
 *
 * Master, Grandmaster and Challenger are one continuous ladder measured in LP,
 * and their divisions mean nothing - Grandmaster simply begins wherever the
 * seven hundredth player sits that day. So above Master the LP alone decides,
 * and a Master on 1311 correctly outranks one on 48 without the tier index
 * getting involved.
 *
 * Unranked returns -1, which sorts it below Iron IV rather than beside it.
 *
 * Shared because both sides need it: the site orders a roster with it, and the
 * worker decides from it whether a standing moved up or down.
 */
export function rankScore(standing: Standing | null | undefined): number {
  if (!standing?.tier) return -1

  const tier = TIER_ORDER.indexOf(standing.tier.toUpperCase() as Tier)
  if (tier < 0) return -1

  if (tier >= TIER_ORDER.indexOf('MASTER')) return APEX_BASE + standing.leaguePoints

  const division = Math.max(0, DIVISION_ORDER.indexOf(standing.rank ?? 'IV'))
  /*
   * Capped at 99 so a division can never reach the next tier's floor: Silver I
   * on 100 LP is a promotion away from Gold IV on 0, and scoring them equal
   * left the order between them to chance.
   */
  return tier * 400 + division * 100 + Math.min(standing.leaguePoints, 99)
}
