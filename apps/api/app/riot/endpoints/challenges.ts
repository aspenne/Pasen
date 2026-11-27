import type { Platform } from '@pasen/shared'

import type { RiotRequester } from '#riot/gateway'
import type { PlayerChallengesDto } from '#riot/types'

export class ChallengesEndpoint {
  constructor(private gateway: RiotRequester) {}

  /**
   * Every challenge's progress for one account. Optional: not every key is
   * entitled to challenges-v1, and a refusal here must not look like a dead key.
   */
  playerData(puuid: string, platform: Platform, options: { priority?: 'interactive' | 'background' } = {}) {
    return this.gateway.request<PlayerChallengesDto>({
      host: { kind: 'platform', platform },
      path: `/lol/challenges/v1/player-data/${puuid}`,
      endpoint: 'challenges-v1.playerData',
      priority: options.priority,
      optional: true,
    })
  }
}
