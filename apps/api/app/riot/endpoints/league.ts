import type { Platform } from '@pasen/shared'

import type { RiotRequester } from '#riot/gateway'
import type { LeagueEntryDto } from '#riot/types'

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
}
