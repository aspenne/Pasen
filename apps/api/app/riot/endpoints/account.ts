import type { Platform } from '@pasen/shared'

import type { RiotRequester } from '#riot/gateway'
import type { AccountDto } from '#riot/types'

export class AccountEndpoint {
  constructor(private gateway: RiotRequester) {}

  /**
   * Resolves `Name#TAG` to the puuid everything else is keyed on. This is the
   * only entry point for adding a player, and the only call that takes a name.
   */
  byRiotId(gameName: string, tagLine: string, platform: Platform) {
    return this.gateway.request<AccountDto>({
      host: { kind: 'account', platform },
      // Riot IDs contain spaces and non-ASCII characters, so each segment is
      // encoded rather than interpolated raw.
      path: `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      endpoint: 'account-v1.byRiotId',
    })
  }

  /** Re-reads the current Riot ID: players rename, and match data goes stale. */
  byPuuid(puuid: string, platform: Platform) {
    return this.gateway.request<AccountDto>({
      host: { kind: 'account', platform },
      path: `/riot/account/v1/accounts/by-puuid/${puuid}`,
      endpoint: 'account-v1.byPuuid',
    })
  }
}
