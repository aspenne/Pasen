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
import { JOBS, type RecentSyncAccountPayload } from '#queues/jobs'
import { queue } from '#queues/main'
import { riot } from '#riot/service'
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
}

export async function processRankSnapshot(): Promise<void> {
  const service = new RankService(riot())

  for (const account of await trackedAccounts()) {
    const result = await service.snapshot(account)
    if (result.recorded.length > 0) {
      logger.info({ account: account.riotId, queues: result.recorded }, 'rank moved')
    }
  }
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
