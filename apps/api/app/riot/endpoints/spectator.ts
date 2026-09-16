import type { Platform } from '@pasen/shared'

import type { RiotRequester } from '#riot/gateway'
import { RiotNotFoundError } from '#riot/errors'
import type { CurrentGameInfoDto } from '#riot/types'

export class SpectatorEndpoint {
  constructor(private gateway: RiotRequester) {}

  /**
   * The live game, including all ten players - which is what lets the dashboard
   * show who a friend is up against.
   *
   * Riot answers 404 for anyone not currently in a game, which is the normal
   * case for almost every poll, so it is translated to null rather than thrown:
   * a caller polling fifteen accounts a minute should not be writing try/catch
   * around the expected outcome. The path segment is named `by-summoner` for
   * historical reasons but takes a puuid.
   */
  async activeGameByPuuid(
    puuid: string,
    platform: Platform
  ): Promise<CurrentGameInfoDto | null> {
    try {
      return await this.gateway.request<CurrentGameInfoDto>({
        host: { kind: 'platform', platform },
        path: `/lol/spectator/v5/active-games/by-summoner/${puuid}`,
        endpoint: 'spectator-v5.activeGame',
      })
    } catch (error) {
      if (error instanceof RiotNotFoundError) {
        return null
      }
      throw error
    }
  }
}
