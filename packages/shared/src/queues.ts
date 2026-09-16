/**
 * Riot publishes the authoritative queue list as static data, which we sync into
 * `static_queues`. This file only carries the coarse grouping the UI filters on,
 * so an unknown/new queue id degrades to `other` instead of breaking a page.
 */

export const QUEUE_GROUPS = ['ranked_solo', 'ranked_flex', 'normal', 'aram', 'arena', 'other'] as const

export type QueueGroup = (typeof QUEUE_GROUPS)[number]

const QUEUE_GROUP_BY_ID: Record<number, QueueGroup> = {
  400: 'normal', // draft pick
  430: 'normal', // blind pick
  490: 'normal', // quickplay
  420: 'ranked_solo',
  440: 'ranked_flex',
  450: 'aram',
  720: 'aram', // ARAM clash
  700: 'ranked_flex', // clash runs on summoner's rift, flex-like
  1700: 'arena',
  1710: 'arena',
  1810: 'arena',
  1820: 'arena',
  1830: 'arena',
  1840: 'arena',
}

export function queueGroupFor(queueId: number): QueueGroup {
  return QUEUE_GROUP_BY_ID[queueId] ?? 'other'
}

export const QUEUE_GROUP_LABELS: Record<QueueGroup, string> = {
  ranked_solo: 'Ranked solo/duo',
  ranked_flex: 'Ranked flex',
  normal: 'Normal',
  aram: 'ARAM',
  arena: 'Arena',
  other: 'Other',
}

/** Queues we never want polluting averages (customs, bots, tutorials). */
const EXCLUDED_QUEUE_IDS = new Set([0, 830, 840, 850, 870, 880, 890, 2000, 2010, 2020])

export function isStatsEligible(queueId: number): boolean {
  return !EXCLUDED_QUEUE_IDS.has(queueId)
}
