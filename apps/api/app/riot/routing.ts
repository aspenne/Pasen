import { accountRegionFor, matchRegionFor, type Platform } from '@pasen/shared'

/**
 * Riot serves different endpoints from different hosts, and using the wrong one
 * answers 404 in a way that looks like "this player does not exist". Callers
 * name the kind of host they need and never build a hostname themselves.
 */
export type RiotHost =
  /** summoner-v4, league-v4, spectator-v5. */
  | { kind: 'platform'; platform: Platform }
  /** match-v5, which has its own sea cluster. */
  | { kind: 'match'; platform: Platform }
  /** account-v1, which folds sea into asia. */
  | { kind: 'account'; platform: Platform }

export function hostnameFor(host: RiotHost): string {
  switch (host.kind) {
    case 'platform':
      return `${host.platform}.api.riotgames.com`
    case 'match':
      return `${matchRegionFor(host.platform)}.api.riotgames.com`
    case 'account':
      return `${accountRegionFor(host.platform)}.api.riotgames.com`
  }
}
