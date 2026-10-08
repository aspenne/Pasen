/**
 * Riot publishes the authoritative queue list as static data, which we sync into
 * `static_queues`. This file carries the grouping the UI filters on.
 *
 * Unknown queue ids are a normal condition, not an anomaly: Riot's own
 * queues.json lags the live game. Queues 1740, 1750 and 3130 are all served by
 * the API today and absent from the published list. So the id is only the first
 * signal; gameMode, which Riot sets per match and never renames, is the fallback.
 */

export const QUEUE_GROUPS = [
  'ranked_solo',
  'ranked_flex',
  'normal',
  'clash',
  'aram',
  'arena',
  /*
   * Inhouses captured by the agent and uploaded, mirrored into the match
   * tables. Riot's own custom games (queue 0) never land here: `queueGroupFor`
   * cannot return this group, so only a capture we hold can be a custom.
   */
  'custom',
  'other',
] as const

export type QueueGroup = (typeof QUEUE_GROUPS)[number]

const QUEUE_GROUP_BY_ID: Record<number, QueueGroup> = {
  420: 'ranked_solo',
  440: 'ranked_flex',

  400: 'normal', // draft pick
  430: 'normal', // blind pick
  490: 'normal', // quickplay
  // Absent from Riot's published list. Identified from a live payload: mapId 11,
  // CLASSIC, MATCHED_GAME, no tournament code, ten players with full roles.
  710: 'normal',

  // Tournament-code games. 3130 was identified the same way: mapId 11, CLASSIC,
  // gameType CUSTOM_GAME and a tournamentCode - organised play, not a practice
  // lobby, so it belongs in the averages rather than out of them.
  700: 'clash',
  3130: 'clash',

  450: 'aram',
  720: 'aram', // ARAM clash

  1700: 'arena',
  1710: 'arena',
  1740: 'arena',
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
  clash: 'Clash',
  aram: 'ARAM',
  arena: 'Arena',
  custom: 'Custom',
  other: 'Other',
}

/**
 * What a page is looking at.
 *
 * `rift` is the default rather than `all` because Arena is a different game:
 * eighteen players, no lanes, no CS, and assist counts that make a KDA there
 * mean nothing next to a KDA on Summoner's Rift. Averaging the two produces a
 * number that describes neither.
 */
export const QUEUE_SCOPES = [
  'rift',
  'ranked_solo',
  'ranked_flex',
  'normal',
  'clash',
  'aram',
  'arena',
  'custom',
  'all',
] as const

export type QueueScope = (typeof QUEUE_SCOPES)[number]

export const SCOPE_LABELS: Record<QueueScope, string> = {
  rift: "Summoner's Rift",
  ranked_solo: 'Ranked solo/duo',
  ranked_flex: 'Ranked flex',
  normal: 'Normal',
  clash: 'Clash',
  aram: 'ARAM',
  arena: 'Arena',
  custom: 'Customs',
  all: 'Every queue',
}

const RIFT_GROUPS: QueueGroup[] = ['ranked_solo', 'ranked_flex', 'normal', 'clash']

/**
 * The queue groups a scope covers. `all` returns null, meaning "do not filter" -
 * an explicit absence rather than a list of every group, so a new group added
 * later is included without touching this.
 */
export function groupsInScope(scope: QueueScope): QueueGroup[] | null {
  if (scope === 'all') {
    return null
  }
  if (scope === 'rift') {
    return RIFT_GROUPS
  }
  return [scope]
}

export const DEFAULT_SCOPE: QueueScope = 'rift'

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
