import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'

import RiotAccount from '#models/riot_account'
import { PuuidRekeyService } from '#ingestion/puuid_rekey_service'
import { riot } from '#riot/service'

/**
 * Manual driver for what the worker now does by itself whenever a key is
 * stored. Kept for two things a job cannot offer: a dry run, and a way to
 * repair an account by hand when something went wrong.
 */
export default class PasenPuuids extends BaseCommand {
  static commandName = 'pasen:puuids'
  static description = 'Re-resolve tracked puuids after an API key rotation'
  static options: CommandOptions = { startApp: true }

  @flags.boolean({ description: 'Apply the change. Without it, only reports.' })
  declare repair: boolean

  async run() {
    if (this.repair) {
      const report = await new PuuidRekeyService(riot(), logger).rekey()

      for (const entry of report.rekeyed) {
        this.logger.success(`${entry.riotId}: rewrote ${entry.participations} participations`)
      }
      for (const riotId of report.unresolved) {
        this.logger.error(`${riotId}: could not resolve`)
      }

      this.logger.info(`done, ${report.rekeyed.length} of ${report.checked} accounts re-keyed`)
      return
    }

    // Dry run: resolve and compare, touching nothing.
    const accounts = await RiotAccount.all()
    let drifted = 0

    for (const account of accounts) {
      const [gameName, tagLine] = account.riotId.split('#')

      let fresh: string
      try {
        fresh = (await riot().account.byRiotId(gameName, tagLine, account.platform)).puuid
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

      this.logger.warning(
        `${account.riotId}: drifted, ${Number(rows?.total ?? 0)} stored participations would move`
      )
    }

    this.logger.info(
      `${drifted} of ${accounts.length} accounts drifted; re-run with --repair to apply`
    )
  }
}
