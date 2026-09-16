/**
 * Riot publishes the authoritative queue list as static data, which we sync into
 * `static_queues`. This file only carries the coarse grouping the UI filters on.
 *
 * Unknown queue ids are a normal condition, not an anomaly: Riot's own
 * queues.json lags the live game. Queue 1750 (an Arena variant) is served by the
 * API today and absent from the published list. So the id is only the first
 * signal; gameMode, which Riot sets per match and never renames, is the fallback.
 */

export const QUEUE_GROUPS = [
  'ranked_solo',
  'ranked_flex',
  'normal',
  'aram',
  'arena',
  'other',
] as const

export type QueueGroup = (typeof QUEUE_GROUPS)[number]

const QUEUE_GROUP_BY_ID: Record<number, QueueGroup> = {
  400: 'normal', // draft pick
  430: 'normal', // blind pick
  490: 'normal', // quickplay
  420: 'ranked_solo',
  440: 'ranked_flex',
  700: 'ranked_flex', // clash, played on summoner's rift
  450: 'aram',
  720: 'aram', // ARAM clash
  1700: 'arena',
  1710: 'arena',
  1750: 'arena',
}

/** Riot's per-match mode string. Stable across queue reshuffles. */
const QUEUE_GROUP_BY_MODE: Record<string, QueueGroup> = {
  CHERRY: 'arena',
  ARAM: 'aram',
}

export function queueGroupFor(queueId: number, gameMode?: string): QueueGroup {
  const byId = QUEUE_GROUP_BY_ID[queueId]
  if (byId) {
    return byId
  }

  if (gameMode) {
    const byMode = QUEUE_GROUP_BY_MODE[gameMode.toUpperCase()]
    if (byMode) {
      return byMode
    }
  }

  return 'other'
}

export const QUEUE_GROUP_LABELS: Record<QueueGroup, string> = {
  ranked_solo: 'Ranked solo/duo',
  ranked_flex: 'Ranked flex',
  normal: 'Normal',
  aram: 'ARAM',
  arena: 'Arena',
  other: 'Other',
}

/** Queues we never want polluting averages: customs, bots, tutorials. */
const EXCLUDED_QUEUE_IDS = new Set([0, 830, 840, 850, 870, 880, 890, 2000, 2010, 2020])
const EXCLUDED_GAME_MODES = new Set([
  'TUTORIAL',
  'TUTORIAL_MODULE_1',
  'TUTORIAL_MODULE_2',
  'TUTORIAL_MODULE_3',
])

export function isStatsEligible(queueId: number, gameMode?: string): boolean {
  if (EXCLUDED_QUEUE_IDS.has(queueId)) {
    return false
  }
  return !(gameMode && EXCLUDED_GAME_MODES.has(gameMode.toUpperCase()))
}

export const TEAM_SIDE_BLUE = 100
export const TEAM_SIDE_RED = 200
