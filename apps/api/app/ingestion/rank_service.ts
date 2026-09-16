import { DateTime } from 'luxon'

import LeagueEntry from '#models/league_entry'
import RiotAccount from '#models/riot_account'
import type { RiotClient } from '#riot/client'

export type RankSnapshotResult = {
  /** Queues whose standing moved, and were therefore recorded. */
  recorded: string[]
  unchanged: number
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
        latest.losses !== entry.losses

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
        capturedAt: now,
      })

      recorded.push(entry.queueType)
    }

    return { recorded, unchanged }
  }
}
