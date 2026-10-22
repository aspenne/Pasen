import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

import { RiotIdRefreshService } from '#ingestion/riot_id_refresh_service'
import { riot } from '#riot/service'

/**
 * Re-reads every account's Riot ID now, rather than waiting for the daily
 * job: after a friend says they renamed, or before rotating the API key.
 */
export default class PasenRiotIds extends BaseCommand {
  static commandName = 'pasen:riot-ids'
  static description = "Re-read every account's Riot ID from Riot, following renames"
  static options: CommandOptions = { startApp: true }

  async run() {
    const report = await new RiotIdRefreshService(riot()).refresh()
    for (const rename of report.renamed) this.logger.success(`${rename.from} is now ${rename.to}`)
    for (const failed of report.failed) this.logger.warning(`could not re-read ${failed}`)
    this.logger.info(`${report.checked} accounts checked, ${report.renamed.length} renamed`)
  }
}
