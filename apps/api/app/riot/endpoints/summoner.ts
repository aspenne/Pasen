import type { Platform } from '@pasen/shared'

import type { RiotRequester } from '#riot/gateway'
import type { SummonerDto } from '#riot/types'

export class SummonerEndpoint {
  constructor(private gateway: RiotRequester) {}

  /** Profile icon and level. The response no longer carries a summonerId. */
  byPuuid(puuid: string, platform: Platform) {
    return this.gateway.request<SummonerDto>({
      host: { kind: 'platform', platform },
      path: `/lol/summoner/v4/summoners/by-puuid/${puuid}`,
      endpoint: 'summoner-v4.byPuuid',
    })
  }
}
