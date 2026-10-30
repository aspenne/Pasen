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

/** One recorded standing: an account's rank in one queue at one moment. */
export type LadderReading = RankReading & { accountId: number; queueType: string; capturedAt: Date }

/** A ranked game an account played: the ladder it counts for and when it began. */
export type LadderGame = { accountId: number; queueType: string; startedAt: Date }

/**
 * LP won or lost by each account over a run of games, every queue summed.
 *
 * Measured from the recorded standings, not counted from wins and losses: a
 * loss Riot refunded after a leaver costs nothing here, which is the point.
 *
 * Anchored to the games rather than to the clock. The standing before is the
 * last reading taken before the first of them began; the standing after is
 * the last one taken before the account's next game in that queue (`next`),
 * or the latest there is. A late game is therefore counted on the day it was
 * played however late its reading came, and a refund that lands before the
 * next game is counted with the loss it refunds. A ladder the account did not
 * play on, decaying or not, is left out. An account first seen after its first
 * game counts from that first reading. A standing with no rank (placements) at
 * either end is skipped, since there is no LP to subtract.
 */
export function lpOverGames(readings: LadderReading[], games: LadderGame[], next: LadderGame[] = []): Map<number, number> {
  const key = (entry: { accountId: number; queueType: string }) => `${entry.accountId}:${entry.queueType}`
  const earliest = (list: LadderGame[]) => {
    const firsts = new Map<string, number>()
    for (const game of list) {
      const time = game.startedAt.getTime()
      if (time < (firsts.get(key(game)) ?? Infinity)) firsts.set(key(game), time)
    }
    return firsts
  }
  const firsts = earliest(games)
  const nexts = earliest(next)

  const series = new Map<string, LadderReading[]>()
  for (const reading of readings) {
    if (!firsts.has(key(reading))) continue
    const list = series.get(key(reading)) ?? []
    list.push(reading)
    series.set(key(reading), list)
  }

  const gained = new Map<number, number>()
  for (const [ladder, list] of series) {
    list.sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime())
    const first = firsts.get(ladder)!
    const until = nexts.get(ladder) ?? Infinity
    const start = list.filter((reading) => reading.capturedAt.getTime() < first).at(-1) ?? list[0]
    const end = list.filter((reading) => reading.capturedAt.getTime() < until).at(-1)
    if (!end || end.capturedAt.getTime() < start.capturedAt.getTime()) continue

    const before = ladderPoints(start)
    const after = ladderPoints(end)
    if (before === null || after === null) continue

    const accountId = list[0].accountId
    gained.set(accountId, (gained.get(accountId) ?? 0) + after - before)
  }
  return gained
}
