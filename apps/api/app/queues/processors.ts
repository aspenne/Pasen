import type { Job } from 'bullmq'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'

import RiotAccount from '#models/riot_account'
import { LiveGameService } from '#ingestion/live_game_service'
import { MatchSyncService } from '#ingestion/match_sync_service'
import { HOT_WINDOW_HOURS, selectLivePollTargets } from '#ingestion/live_poll_selection'
import { PuuidRekeyService } from '#ingestion/puuid_rekey_service'
import { RankService } from '#ingestion/rank_service'
import {
  decayAnnouncement,
  pentakillAnnouncement,
  rankAnnouncement,
  streakAnnouncement,
} from '#notifications/announcements'
import { DiscordService } from '#notifications/discord_service'
import { JOBS, type RecentSyncAccountPayload } from '#queues/jobs'
import { queue } from '#queues/main'
import { riot } from '#riot/service'
import { DecayService, decayKey } from '#stats/decay_service'
import { RiotKeyRejectedError } from '#riot/errors'
import type { RedisLike } from '#riot/redis'
import { DDragonService } from '#static_data/ddragon_service'

/**
 * Budget per backfill step. Small on purpose: a step holds the shared Riot
 * budget while it runs, and a long one would starve live polling.
 */
const BACKFILL_FETCHES_PER_STEP = 25

function trackedAccounts() {
  return RiotAccount.query().orderBy('id')
}

/** When each account last actually played, for deciding who is worth polling. */
async function lastPlayedAt(): Promise<Map<number, DateTime>> {
  const rows = await db
    .from('riot_accounts as a')
    .join('match_participants as p', 'p.puuid', 'a.puuid')
    .join('matches as m', 'm.match_id', 'p.match_id')
    .where('m.game_creation', '>', DateTime.utc().minus({ hours: HOT_WINDOW_HOURS }).toSQL()!)
    .groupBy('a.id')
    .select('a.id')
    .max('m.game_creation as at')

  return new Map(
    rows.map((row: { id: number; at: string | Date }) => [
      Number(row.id),
      DateTime.fromJSDate(new Date(row.at)),
    ])
  )
}

export async function processLive(): Promise<void> {
  const accounts = await trackedAccounts()
  if (accounts.length === 0) {
    return
  }

  const targets = selectLivePollTargets(accounts, await lastPlayedAt(), DateTime.utc())
  if (targets.length === 0) {
    return
  }

  const service = new LiveGameService(riot(), redis.connection() as unknown as RedisLike)
  const result = await service.poll(targets)

  /*
   * A game that just ended is fetchable within seconds. Queueing its account now
   * is what puts the match in the feed almost immediately, instead of whenever
   * the next scheduled sync happens to come round.
   */
  for (const account of result.justFinished) {
    await queue('recent').add(
      JOBS.recentSyncAccount,
      { riotAccountId: account.id } satisfies RecentSyncAccountPayload,
      { priority: 1 }
    )
  }

  logger.info(
    {
      polled: result.polled,
      skipped: accounts.length - targets.length,
      inGame: result.inGame,
      justFinished: result.justFinished.length,
    },
    'live poll'
  )
}

export async function processRecentSync(): Promise<void> {
  const accounts = await trackedAccounts()
  const service = new MatchSyncService(riot())

  for (const account of accounts) {
    const outcome = await service.syncRecent(account)
    if (outcome.ingested > 0) {
      logger.info({ account: account.riotId, ...outcome }, 'recent sync')
    }
  }
}

export async function processRecentSyncAccount(job: Job<RecentSyncAccountPayload>): Promise<void> {
  const account = await RiotAccount.find(job.data.riotAccountId)
  if (!account) {
    return
  }

  const outcome = await new MatchSyncService(riot()).syncRecent(account)
  logger.info({ account: account.riotId, ...outcome }, 'post-game sync')

  if (outcome.ingested > 0) await announceFrom(account)
}

export async function processRankSnapshot(): Promise<void> {
  const service = new RankService(riot())
  const discord = new DiscordService()
  const today = DateTime.utc().toISODate()!

  for (const account of await trackedAccounts()) {
    const result = await service.snapshot(account)
    if (result.recorded.length > 0) {
      logger.info({ account: account.riotId, queues: result.recorded }, 'rank moved')
    }

    if (result.moves.length === 0) continue

    await account.load('member')
    for (const move of result.moves) {
      const announcement = rankAnnouncement(account.member.displayName, account.id, move, today)
      if (announcement) await discord.announce(announcement)
    }
  }

  await announceDecay(discord)
}

/**
 * Warns the channel before a standing starts bleeding LP.
 *
 * Runs off the snapshot that has just been written rather than off its own
 * schedule, because the standings it reads are only as fresh as that snapshot.
 * One query for every account at once: the countdown is cheap to derive but not
 * cheap to derive twenty-six times.
 */
async function announceDecay(discord: DiscordService): Promise<void> {
  if (!(await discord.webhookUrl())) return

  const rows = await db.rawQuery(
    `SELECT DISTINCT ON (e.riot_account_id, e.queue_type)
            e.riot_account_id, e.queue_type, e.tier, e.inactive,
            a.puuid, m.display_name, COALESCE(g.timezone, 'Europe/Paris') AS timezone
     FROM league_entries e
     JOIN riot_accounts a ON a.id = e.riot_account_id
     JOIN members m ON m.id = a.member_id
     LEFT JOIN group_members gm ON gm.member_id = m.id
     LEFT JOIN groups g ON g.id = gm.group_id
     ORDER BY e.riot_account_id, e.queue_type, e.captured_at DESC`
  )

  if (rows.rows.length === 0) return

  const timezone = rows.rows[0].timezone as string
  const estimates = await new DecayService().forAccounts(
    rows.rows.map((row: any) => ({
      accountId: row.riot_account_id,
      puuid: row.puuid,
      queueType: row.queue_type,
      tier: row.tier,
    })),
    timezone
  )

  const day = DateTime.utc().setZone(timezone).toFormat('yyyy-MM-dd')

  for (const row of rows.rows) {
    const estimate = estimates.get(decayKey(row.riot_account_id, row.queue_type))
    if (!estimate) continue

    const announcement = decayAnnouncement(
      row.display_name,
      row.riot_account_id,
      row.queue_type,
      DecayService.reconcile(estimate, row.inactive),
      day
    )
    if (announcement) await discord.announce(announcement)
  }
}

/**
 * What a freshly ingested game is worth telling the channel.
 *
 * Read from the database rather than from the ingest result, because a match
 * shared by several members is ingested once and the others' rows are already
 * there - and because the streak has to be counted over history anyway.
 */
async function announceFrom(account: RiotAccount): Promise<void> {
  const discord = new DiscordService()
  if (!(await discord.webhookUrl())) return

  await account.load('member')
  const name = account.member.displayName

  const recent = await db
    .from('match_participants as p')
    .join('matches as m', 'm.match_id', 'p.match_id')
    .where('p.puuid', account.puuid)
    .andWhere('m.stats_eligible', true)
    // A streak or a penta announced from Riot's games, not from an inhouse uploaded days later.
    .andWhereNot('m.queue_group', 'custom')
    .orderBy('m.game_creation', 'desc')
    .limit(20)
    .select('p.match_id', 'p.win', 'p.penta_kills', 'p.champion_name')

  if (recent.length === 0) return

  for (const row of recent.slice(0, 3)) {
    if (Number(row.penta_kills) > 0) {
      await discord.announce(
        pentakillAnnouncement(name, row.champion_name, row.match_id, account.puuid)
      )
    }
  }

  // Counted from the newest backwards; the run ends at the first defeat.
  let streak = 0
  for (const row of recent) {
    if (!row.win) break
    streak++
  }

  const announcement = streakAnnouncement(name, streak, recent[0].match_id, account.id)
  if (announcement) await discord.announce(announcement)
}

export async function processBackfillStep(): Promise<void> {
  /*
   * One account per tick, least recently touched first. Round-robin rather than
   * draining one account at a time, so adding ten accounts does not leave the
   * tenth with nothing on the site for an hour.
   */
  const account = await RiotAccount.query()
    .whereNot('backfill_state', 'done')
    .orderByRaw('last_synced_at asc nulls first')
    .first()

  if (!account) {
    return
  }

  try {
    account.backfillState = 'running'
    await account.save()

    const outcome = await new MatchSyncService(riot()).backfillStep(account, {
      maxFetches: BACKFILL_FETCHES_PER_STEP,
    })

    logger.info({ account: account.riotId, ...outcome }, 'backfill step')
  } catch (error) {
    // A dead key is not this account's fault and will fail every other account
    // the same way, so leave it retryable rather than marking it failed.
    if (!(error instanceof RiotKeyRejectedError)) {
      account.backfillState = 'failed'
      account.backfillError = error instanceof Error ? error.message : String(error)
      await account.save()
    }
    throw error
  }
}

export async function processStaticSync(): Promise<void> {
  const result = await new DDragonService({ logger }).sync()
  if (!result.skipped) {
    logger.info(result, 'data dragon synced')
  }
}

export async function processPuuidRekey(): Promise<void> {
  const report = await new PuuidRekeyService(riot(), logger).rekey()

  if (report.rekeyed.length === 0 && report.unresolved.length === 0) {
    logger.info({ checked: report.checked }, 'puuids still valid')
    return
  }

  logger.warn(
    {
      checked: report.checked,
      rekeyed: report.rekeyed.length,
      participations: report.rekeyed.reduce((sum, entry) => sum + entry.participations, 0),
      unresolved: report.unresolved,
    },
    'puuids re-keyed after an API key change'
  )
}
