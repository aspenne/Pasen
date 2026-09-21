import db from '@adonisjs/lucid/services/db'
import type { Logger } from '@adonisjs/core/logger'

import RiotAccount from '#models/riot_account'
import type { RiotClient } from '#riot/client'

export type RekeyOutcome = {
  riotId: string
  /** Rows in match_participants that moved with the account. */
  participations: number
}

export type RekeyReport = {
  checked: number
  rekeyed: RekeyOutcome[]
  unresolved: string[]
}

/**
 * Re-resolves every tracked account's puuid and moves its history with it.
 *
 * Riot encrypts puuids per API key, so rotating a key invalidates every
 * identifier we hold: any call taking one comes back "Bad Request - Exception
 * decrypting". The dangerous half is quieter. A member's matches are joined on
 * that same puuid, so re-resolving the account alone would leave every one of
 * their stored games pointing at an identifier nobody owns any more - their
 * whole history gone from the site, with nothing logging an error.
 *
 * Hence one transaction per account, history first, and only our members'
 * rows: the other participants of a match keep the puuid they were stored
 * with, since we never call Riot with those and they only ever mark a row as
 * belonging to someone outside the group.
 *
 * Safe to run at any time. An account whose puuid still resolves to what we
 * hold is left untouched.
 */
export class PuuidRekeyService {
  constructor(
    private riot: RiotClient,
    private logger?: Logger
  ) {}

  async rekey(): Promise<RekeyReport> {
    const accounts = await RiotAccount.all()
    const report: RekeyReport = { checked: accounts.length, rekeyed: [], unresolved: [] }

    for (const account of accounts) {
      const [gameName, tagLine] = account.riotId.split('#')

      let fresh: string
      try {
        const resolved = await this.riot.account.byRiotId(gameName, tagLine, account.platform)
        fresh = resolved.puuid
      } catch (error) {
        // One unreachable account must not strand the other twenty-four.
        this.logger?.warn(
          { riotId: account.riotId, err: error instanceof Error ? error.message : String(error) },
          'could not resolve puuid'
        )
        report.unresolved.push(account.riotId)
        continue
      }

      if (fresh === account.puuid) continue

      const stale = account.puuid
      const moved = await db.transaction(async (trx) => {
        const rows = await trx
          .from('match_participants')
          .where('puuid', stale)
          .update({ puuid: fresh })
        await trx.from('riot_accounts').where('id', account.id).update({ puuid: fresh })
        return Number(rows)
      })

      this.logger?.info({ riotId: account.riotId, participations: moved }, 'puuid re-keyed')
      report.rekeyed.push({ riotId: account.riotId, participations: moved })
    }

    return report
  }
}
