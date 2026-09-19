import type { Platform } from '@pasen/shared'

import type { RiotRequester } from '#riot/gateway'
import type { LeagueEntryDto, LeagueListDto } from '#riot/types'

export class LeagueEndpoint {
  constructor(private gateway: RiotRequester) {}

  /**
   * Ranked standing per queue. Keyed on puuid since 2025-06-20, when Riot
   * removed the by-summoner variant along with summonerId itself.
   *
   * Returns an empty array for an unranked player, which is not an error.
   */
  entriesByPuuid(
    puuid: string,
    platform: Platform,
    options: { priority?: 'interactive' | 'background' } = {}
  ) {
    return this.gateway.request<LeagueEntryDto[]>({
      host: { kind: 'platform', platform },
      path: `/lol/league/v4/entries/by-puuid/${puuid}`,
      endpoint: 'league-v4.entriesByPuuid',
      priority: options.priority,
    })
  }

  /**
   * A whole apex league in one response. Master, Grandmaster and Challenger are
   * the only tiers with an ordered ladder - below them Riot exposes no position
   * at all, only the tier and division a player sits in.
   */
  apexLeague(
    apex: 'master' | 'grandmaster' | 'challenger',
    queue: string,
    platform: Platform,
    options: { priority?: 'interactive' | 'background' } = {}
  ) {
    return this.gateway.request<LeagueListDto>({
      host: { kind: 'platform', platform },
      path: `/lol/league/v4/${apex}leagues/by-queue/${queue}`,
      endpoint: `league-v4.${apex}Leagues`,
      priority: options.priority,
    })
  }
}
