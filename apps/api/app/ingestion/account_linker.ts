import type { Platform } from '@pasen/shared'
import { DateTime } from 'luxon'

import Member from '#models/member'
import RiotAccount from '#models/riot_account'
import type { RiotClient } from '#riot/client'

export type LinkRequest = {
  memberId: number
  gameName: string
  tagLine: string
  platform: Platform
  /** How far back the backfill should reach. Defaults to the current split. */
  backfillTarget?: DateTime
}

/**
 * The only way an account enters the system. Riot IDs are not identifiers -
 * players rename, and two people can hold the same name on different platforms -
 * so a name is resolved to a puuid once and never trusted again.
 */
export class AccountLinker {
  constructor(private riot: RiotClient) {}

  async link(request: LinkRequest): Promise<RiotAccount> {
    const member = await Member.findOrFail(request.memberId)

    const account = await this.riot.account.byRiotId(
      request.gameName,
      request.tagLine,
      request.platform
    )

    /*
     * Keyed on puuid, not on member + name. Re-adding an account that already
     * exists updates it rather than creating a duplicate, and moving an account
     * to a different member is a normal correction rather than a conflict.
     */
    const existing = await RiotAccount.findBy('puuid', account.puuid)

    const row =
      existing ??
      new RiotAccount().merge({
        puuid: account.puuid,
        backfillTarget: request.backfillTarget ?? null,
        backfillState: 'pending',
      })

    row.merge({
      memberId: member.id,
      // Riot's casing is authoritative, whatever the admin typed.
      gameName: account.gameName,
      tagLine: account.tagLine,
      platform: request.platform,
    })

    await row.save()
    await this.refreshProfile(row)

    return row
  }

  /**
   * Refreshes the parts of an account that drift: the Riot ID after a rename,
   * and the icon and level shown on the profile page.
   */
  async refreshProfile(account: RiotAccount): Promise<RiotAccount> {
    const [identity, summoner] = await Promise.all([
      this.riot.account.byPuuid(account.puuid, account.platform),
      this.riot.summoner.byPuuid(account.puuid, account.platform),
    ])

    account.merge({
      gameName: identity.gameName,
      tagLine: identity.tagLine,
      profileIconId: summoner.profileIconId,
      summonerLevel: summoner.summonerLevel,
    })

    await account.save()
    return account
  }
}
