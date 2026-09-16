/**
 * Riot splits its API across two kinds of hosts and you must pick the right one
 * per endpoint, or you get a 404 that looks like "player not found":
 *
 *   - platform hosts  (euw1, na1, kr, ...)  -> summoner-v4, league-v4, spectator-v5
 *   - regional hosts  (europe, americas, ...) -> account-v1, match-v5
 *
 * The two regional maps below are NOT interchangeable: match-v5 serves the SEA
 * cluster, while account-v1 does not and expects those players on `asia`.
 */

export const PLATFORMS = [
  'br1',
  'eun1',
  'euw1',
  'jp1',
  'kr',
  'la1',
  'la2',
  'me1',
  'na1',
  'oc1',
  'ph2',
  'ru',
  'sg2',
  'th2',
  'tr1',
  'tw2',
  'vn2',
] as const

export type Platform = (typeof PLATFORMS)[number]

export type MatchRegion = 'americas' | 'asia' | 'europe' | 'sea'
export type AccountRegion = 'americas' | 'asia' | 'europe'

/** Routing for match-v5. This one has a real `sea` cluster. */
const MATCH_REGION: Record<Platform, MatchRegion> = {
  br1: 'americas',
  la1: 'americas',
  la2: 'americas',
  na1: 'americas',
  eun1: 'europe',
  euw1: 'europe',
  me1: 'europe',
  ru: 'europe',
  tr1: 'europe',
  jp1: 'asia',
  kr: 'asia',
  oc1: 'sea',
  ph2: 'sea',
  sg2: 'sea',
  th2: 'sea',
  tw2: 'sea',
  vn2: 'sea',
}

export function matchRegionFor(platform: Platform): MatchRegion {
  return MATCH_REGION[platform]
}

/** Routing for account-v1, which folds SEA into `asia`. */
export function accountRegionFor(platform: Platform): AccountRegion {
  const region = MATCH_REGION[platform]
  return region === 'sea' ? 'asia' : region
}

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value)
}

/** Human labels for the admin form. */
export const PLATFORM_LABELS: Record<Platform, string> = {
  br1: 'Brazil',
  eun1: 'Europe Nordic & East',
  euw1: 'Europe West',
  jp1: 'Japan',
  kr: 'Korea',
  la1: 'Latin America North',
  la2: 'Latin America South',
  me1: 'Middle East',
  na1: 'North America',
  oc1: 'Oceania',
  ph2: 'Philippines',
  ru: 'Russia',
  sg2: 'Singapore',
  th2: 'Thailand',
  tr1: 'Turkey',
  tw2: 'Taiwan',
  vn2: 'Vietnam',
}
