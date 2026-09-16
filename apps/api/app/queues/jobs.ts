/**
 * Job names and payloads, in one place so the producer and the processor cannot
 * drift apart.
 */
export const JOBS = {
  /** Poll spectator-v5 for every tracked account. */
  livePoll: 'live:poll',
  /** Pull new matches for every tracked account. */
  recentSync: 'recent:sync',
  /** Pull new matches for one account, right after its game ended. */
  recentSyncAccount: 'recent:sync-account',
  /** Snapshot ranked standings. */
  rankSnapshot: 'recent:rank-snapshot',
  /** Walk one account's history one page backwards. */
  backfillStep: 'backfill:step',
  /** Re-import Data Dragon when the patch moves. */
  staticSync: 'backfill:static-sync',
} as const

export type RecentSyncAccountPayload = { riotAccountId: number }
