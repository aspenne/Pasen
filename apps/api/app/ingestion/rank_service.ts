import { DateTime } from 'luxon'

import LeagueEntry from '#models/league_entry'
import RiotAccount from '#models/riot_account'
import type { RiotClient } from '#riot/client'
import { rankScore } from '@pasen/shared'

/** A standing that crossed into a different tier or division, in either direction. */
export type RankMove = {
  queueType: string
  from: { tier: string | null; rank: string | null } | null
  to: { tier: string; rank: string | null }
  leaguePoints: number
  /** True when the new standing is above the old one. */
  promotion: boolean
}

export type RankSnapshotResult = {
  /** Queues whose standing moved, and were therefore recorded. */
  recorded: string[]
  unchanged: number
  /**
   * The subset worth telling someone about. A few points of LP is not news;
   * changing division is, and changing tier especially.
   */
  moves: RankMove[]
}

/**
 * Records rank over time, which is what turns a current standing into an LP
 * curve.
 *
 * A row is written only when something actually moved. Polling hourly and
 * storing unconditionally would add a row per account per queue per hour
 * forever, and a chart drawn from it would be mostly flat duplicates.
 */
export class RankService {
  constructor(private riot: RiotClient) {}

  async snapshot(account: RiotAccount, now = DateTime.utc()): Promise<RankSnapshotResult> {
    const entries = await this.riot.league.entriesByPuuid(account.puuid, account.platform)

    const recorded: string[] = []
    const moves: RankMove[] = []
    let unchanged = 0

    for (const entry of entries) {
      const latest = await LeagueEntry.query()
        .where('riot_account_id', account.id)
        .andWhere('queue_type', entry.queueType)
        .orderBy('captured_at', 'desc')
        .first()

      // Wins and losses are part of the comparison: a win that gains no LP at
      // the top of a division is still a change worth a point on the curve.
      const moved =
        !latest ||
        latest.leaguePoints !== entry.leaguePoints ||
        latest.tier !== entry.tier ||
        latest.rank !== entry.rank ||
        latest.wins !== entry.wins ||
        latest.losses !== entry.losses ||
        // Entering or leaving decay is a change even when the LP has not moved.
        latest.inactive !== entry.inactive

      if (!moved) {
        unchanged++
        continue
      }

      await LeagueEntry.create({
        riotAccountId: account.id,
        queueType: entry.queueType,
        tier: entry.tier,
        rank: entry.rank,
        leaguePoints: entry.leaguePoints,
        wins: entry.wins,
        losses: entry.losses,
        hotStreak: entry.hotStreak,
        inactive: entry.inactive,
        capturedAt: now,
      })

      recorded.push(entry.queueType)

      // A first sighting is not a promotion: we simply had not looked before.
      if (latest && (latest.tier !== entry.tier || latest.rank !== entry.rank)) {
        moves.push({
          queueType: entry.queueType,
          from: { tier: latest.tier, rank: latest.rank },
          to: { tier: entry.tier, rank: entry.rank },
          leaguePoints: entry.leaguePoints,
          promotion:
            rankScore({ tier: entry.tier, rank: entry.rank, leaguePoints: entry.leaguePoints }) >
            rankScore({
              tier: latest.tier,
              rank: latest.rank,
              leaguePoints: latest.leaguePoints,
            }),
        })
      }
    }

    return { recorded, unchanged, moves }
  }
}
