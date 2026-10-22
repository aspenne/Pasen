import db from '@adonisjs/lucid/services/db'
import type { Logger } from '@adonisjs/core/logger'

import RiotAccount from '#models/riot_account'
import RiotAccountAlias from '#models/riot_account_alias'
import { syncMemberNames } from '#ingestion/member_names'
import type { RiotClient } from '#riot/client'

export type RiotIdRefreshReport = {
  checked: number
  renamed: { accountId: number; from: string; to: string }[]
  /** Riot IDs Riot could not answer for this time; tried again next run. */
  failed: string[]
}

/**
 * Keeps each tracked account's Riot ID current.
 *
 * A rename keeps the puuid, so matches and ranks follow by themselves - but a
 * stale name is not harmless. When the API key changes, puuids are found
 * again from the Riot ID, and an old one finds nobody: the account and its
 * history would come loose. Run daily, this keeps the name fresh, and keeps
 * the old one as an alias so games known only by name - customs - still
 * belong to the same player.
 */
export class RiotIdRefreshService {
  constructor(
    private riot: RiotClient,
    private logger?: Logger
  ) {}

  async refresh(): Promise<RiotIdRefreshReport> {
    const accounts = await RiotAccount.query().orderBy('id')
    const report: RiotIdRefreshReport = { checked: accounts.length, renamed: [], failed: [] }

    for (const account of accounts) {
      let current
      try {
        current = await this.riot.account.byPuuid(account.puuid, account.platform)
      } catch (error) {
        this.logger?.warn({ account: account.riotId, err: (error as Error).message }, 'could not re-read Riot ID')
        report.failed.push(account.riotId)
        continue
      }

      const before = `${account.gameName}#${account.tagLine}`
      const after = `${current.gameName}#${current.tagLine}`
      // Riot IDs are compared without case, as Riot does: "patate" and "Patate" are one name.
      if (before.toLowerCase() === after.toLowerCase()) continue

      await db.transaction(async (trx) => {
        const known = await RiotAccountAlias.query({ client: trx })
          .where('riot_account_id', account.id)
          .whereRaw('lower(game_name) = ? and lower(tag_line) = ?', [
            account.gameName.toLowerCase(),
            account.tagLine.toLowerCase(),
          ])
          .first()
        if (!known) {
          await RiotAccountAlias.create(
            { riotAccountId: account.id, gameName: account.gameName, tagLine: account.tagLine, source: 'riot' },
            { client: trx }
          )
        }
        account.useTransaction(trx)
        account.gameName = current.gameName
        account.tagLine = current.tagLine
        await account.save()
      })

      report.renamed.push({ accountId: account.id, from: before, to: after })
    }

    // Members are shown by their first account's in-game name: follow the renames.
    await syncMemberNames()
    return report
  }
}
