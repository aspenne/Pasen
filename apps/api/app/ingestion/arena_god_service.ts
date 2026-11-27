import { ARENA_GOD } from '@pasen/shared'
import { DateTime } from 'luxon'

import type RiotAccount from '#models/riot_account'
import { RiotApiError } from '#riot/errors'
import type { RiotClient } from '#riot/client'

/**
 * Reads an account's Arena God progress from Riot and keeps it on the account.
 *
 * An account that never placed first has no entry for the challenge: that is
 * 0, not unknown. A key not entitled to challenges-v1 leaves the value as it
 * was - the roster then simply shows nothing - and says so once in the result.
 */
export class ArenaGodService {
  constructor(private riot: Pick<RiotClient, 'challenges'>) {}

  async refresh(account: RiotAccount): Promise<'updated' | 'not-entitled'> {
    let data
    try {
      data = await this.riot.challenges.playerData(account.puuid, account.platform, { priority: 'background' })
    } catch (error) {
      if (error instanceof RiotApiError && (error.status === 401 || error.status === 403)) return 'not-entitled'
      throw error
    }

    const entry = data.challenges.find((challenge) => challenge.challengeId === ARENA_GOD.challengeId)
    account.arenaGod = entry ? Math.round(entry.value) : 0
    account.arenaGodCheckedAt = DateTime.now()
    await account.save()
    return 'updated'
  }
}
