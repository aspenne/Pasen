import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import RiotAccount from '#models/riot_account'
import { MatchIngestService } from '#ingestion/match_ingest_service'
import { MATCH_IDS_PAGE_SIZE } from '#riot/endpoints/match'
import type { RiotClient } from '#riot/client'

export type SyncOutcome = {
  /** Ids Riot listed for this account in this step. */
  listed: number
  /** Ids we already had, from another member's sync of the same game. */
  alreadyStored: number
  /** Matches actually fetched and written. */
  ingested: number
  /** True when the backfill has reached its target and will not run again. */
  complete?: boolean
}

export type SyncOptions = {
  /** Backfill passes 'background' so it leaves budget for live polling. */
  priority?: 'interactive' | 'background'
  /**
   * Upper bound on match detail fetches per step. Each one is a Riot request
   * against a budget of 100 per two minutes, so a step stays small enough to
   * interleave with live polling instead of monopolising the key.
   */
  maxFetches?: number
}

const DEFAULT_MAX_FETCHES = 40

export class MatchSyncService {
  constructor(
    private riot: RiotClient,
    private ingest = new MatchIngestService()
  ) {}

  /**
   * Pulls anything played since the last sync. Cheap in the common case: an
   * account with no new games costs exactly one request.
   */
  async syncRecent(account: RiotAccount, options: SyncOptions = {}): Promise<SyncOutcome> {
    const ids = await this.riot.match.idsByPuuid(account.puuid, account.platform, {
      count: MATCH_IDS_PAGE_SIZE,
      // Inclusive on Riot's side, so start just past the newest match we hold
      // rather than re-listing it every time.
      startTime: account.syncedTo ? Math.floor(account.syncedTo.toSeconds()) + 1 : undefined,
    })

    const outcome = await this.#fetchAndStore(account, ids, options)
    await this.#advanceFrontiers(account)

    account.lastSyncedAt = DateTime.utc()
    await account.save()

    return outcome
  }

  /**
   * Walks history backwards one page at a time. Split across steps so a long
   * backfill can be paused, resumed after a crash, and preempted by live work.
   */
  async backfillStep(account: RiotAccount, options: SyncOptions = {}): Promise<SyncOutcome> {
    const background = { ...options, priority: 'background' as const }

    const ids = await this.riot.match.idsByPuuid(
      account.puuid,
      account.platform,
      {
        count: MATCH_IDS_PAGE_SIZE,
        // Riot's endTime is inclusive; stepping back a second stops the oldest
        // match we already hold from heading every subsequent page forever.
        endTime: account.syncedFrom ? Math.floor(account.syncedFrom.toSeconds()) - 1 : undefined,
        startTime: account.backfillTarget
          ? Math.floor(account.backfillTarget.toSeconds())
          : undefined,
      },
      background
    )

    const outcome = await this.#fetchAndStore(account, ids, background)
    await this.#advanceFrontiers(account)

    /*
     * A short page means Riot has nothing older left inside the window, which is
     * the only reliable end signal: an empty page can also mean every match on
     * it was already stored.
     */
    const complete = ids.length < MATCH_IDS_PAGE_SIZE
    account.backfillState = complete ? 'done' : 'running'
    // A step that got through clears whatever the last failure was. Leaving it
    // behind shows an error next to a finished backfill, which reads as broken.
    account.backfillError = null
    account.lastSyncedAt = DateTime.utc()
    await account.save()

    return { ...outcome, complete }
  }

  /**
   * Fetches only what is missing. Group members share games, so by the time the
   * fourth person syncs a five-stack, the match is usually already stored - and
   * skipping it is the difference between four requests and one.
   */
  async #fetchAndStore(
    account: RiotAccount,
    ids: string[],
    options: SyncOptions
  ): Promise<SyncOutcome> {
    if (ids.length === 0) {
      return { listed: 0, alreadyStored: 0, ingested: 0 }
    }

    const known = await db
      .from('matches')
      .whereIn('match_id', ids)
      .select('match_id')
      .then((rows) => new Set(rows.map((row) => row.match_id as string)))

    const missing = ids.filter((id) => !known.has(id))
    const budget = options.maxFetches ?? DEFAULT_MAX_FETCHES
    const toFetch = missing.slice(0, budget)

    let ingested = 0
    for (const id of toFetch) {
      const match = await this.riot.match.byId(id, account.platform, {
        priority: options.priority,
      })
      await this.ingest.ingest(match)
      ingested++
    }

    return { listed: ids.length, alreadyStored: known.size, ingested }
  }

  /**
   * Frontiers come from what is actually stored, not from what this step
   * fetched. A match ingested by someone else's sync still counts as covered,
   * and a step that fetched nothing must not rewind the cursor.
   */
  async #advanceFrontiers(account: RiotAccount): Promise<void> {
    const [bounds] = await db
      .from('match_participants')
      .join('matches', 'matches.match_id', 'match_participants.match_id')
      .where('match_participants.puuid', account.puuid)
      .select(
        db.raw('min(matches.game_creation) as oldest'),
        db.raw('max(matches.game_creation) as newest')
      )

    if (!bounds?.newest) {
      return
    }

    account.syncedTo = DateTime.fromJSDate(new Date(bounds.newest))
    account.syncedFrom = DateTime.fromJSDate(new Date(bounds.oldest))
  }
}
