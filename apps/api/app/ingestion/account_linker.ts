import string from '@adonisjs/core/helpers/string'
import type { Platform } from '@pasen/shared'
import { DateTime } from 'luxon'

import Member from '#models/member'
import RiotAccount from '#models/riot_account'
import type { RiotClient } from '#riot/client'

export type LinkRequest = {
  gameName: string
  tagLine: string
  platform: Platform
  /** Attach the account to this member explicitly. */
  memberId?: number
  /** Name for a member created on the spot. Defaults to the Riot ID's name. */
  memberName?: string
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
    const identity = await this.riot.account.byRiotId(
      request.gameName,
      request.tagLine,
      request.platform
    )

    /*
     * Keyed on puuid, not on member + name. Re-adding an account that already
     * exists updates it rather than creating a duplicate, and moving an account
     * to a different member is a normal correction rather than a conflict.
     */
    const existing = await RiotAccount.findBy('puuid', identity.puuid)
    const member = await this.#memberFor(request, existing, identity.gameName)

    const account =
      existing ??
      new RiotAccount().merge({
        puuid: identity.puuid,
        backfillTarget: request.backfillTarget ?? null,
        backfillState: 'pending',
      })

    account.merge({
      memberId: member.id,
      // Riot's casing is authoritative, whatever the admin typed.
      gameName: identity.gameName,
      tagLine: identity.tagLine,
      platform: request.platform,
    })

    await account.save()
    await this.refreshProfile(account)

    return account
  }

  /**
   * Re-adding an account already in the system must not invent a second member
   * for the same person. Without an explicit choice, an existing account keeps
   * whoever owns it - otherwise running the add command twice, once with a
   * nickname and once without, silently splits one player into two and leaves
   * the first with no accounts at all.
   */
  async #memberFor(
    request: LinkRequest,
    existing: RiotAccount | null,
    gameName: string
  ): Promise<Member> {
    if (request.memberId) {
      return Member.findOrFail(request.memberId)
    }

    if (existing) {
      return Member.findOrFail(existing.memberId)
    }

    const displayName = request.memberName ?? gameName
    return Member.updateOrCreate(
      { slug: string.slug(displayName).toLowerCase() },
      { displayName }
    )
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
