import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

import RiotAccount from '#models/riot_account'
import { riot } from '#riot/service'

/**
 * Re-resolves every tracked account's puuid and, on request, rewrites the
 * history that pointed at the old one.
 *
 * Riot encrypts puuids per API key. Rotating a key therefore silently
 * invalidates every identifier we hold: calls taking a puuid come back "Bad
 * Request - Exception decrypting", and the join from a member to their matches
 * stops matching anything, which would read as a player's whole history
 * vanishing.
 *
 * Only our members' rows are rewritten. The other nine participants of each
 * match keep the puuid they were stored with - we never call Riot with those,
 * they only ever identify a row as "not one of us".
 */
export default class PasenPuuids extends BaseCommand {
  static commandName = 'pasen:puuids'
  static description = 'Re-resolve tracked puuids after an API key rotation'
  static options: CommandOptions = { startApp: true }

  @flags.boolean({ description: 'Apply the change. Without it, only reports.' })
  declare repair: boolean

  async run() {
    const accounts = await RiotAccount.all()
    let drifted = 0

    for (const account of accounts) {
      const [gameName, tagLine] = account.riotId.split('#')

      let fresh: string
      try {
        const resolved = await riot().account.byRiotId(gameName, tagLine, account.platform)
        fresh = resolved.puuid
      } catch (error) {
        this.logger.error(
          `${account.riotId}: could not resolve (${error instanceof Error ? error.message : error})`
        )
        continue
      }

      if (fresh === account.puuid) {
        this.logger.info(`${account.riotId}: unchanged`)
        continue
      }

      drifted++
      const rows = await db
        .from('match_participants')
        .where('puuid', account.puuid)
        .count('* as total')
        .first()
      const affected = Number(rows?.total ?? 0)

      if (!this.repair) {
        this.logger.warning(
          `${account.riotId}: drifted, ${affected} stored participations would be rewritten`
        )
        continue
      }

      /*
       * One transaction per account: history and account must move together, or
       * a crash halfway leaves a member pointing at rows that no longer carry
       * their id.
       */
      await db.transaction(async (trx) => {
        await trx
          .from('match_participants')
          .where('puuid', account.puuid)
          .update({ puuid: fresh })
        await trx.from('riot_accounts').where('id', account.id).update({ puuid: fresh })
      })

      this.logger.success(`${account.riotId}: rewrote ${affected} participations`)
    }

    this.logger.info(
      this.repair
        ? `done, ${drifted} accounts re-keyed`
        : `${drifted} of ${accounts.length} accounts drifted; re-run with --repair to apply`
    )
  }
}
