import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

import logger from '@adonisjs/core/services/logger'

import { DDragonService } from '#static_data/ddragon_service'

export default class StaticSync extends BaseCommand {
  static commandName = 'static:sync'
  static description = 'Import champions, items, summoner spells and queues from Data Dragon'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'Re-import even when the patch has not changed' })
  declare force: boolean

  async run() {
    const service = new DDragonService({ logger })
    const result = await service.sync({ force: this.force })

    if (result.skipped) {
      this.logger.info(`already on ${result.version}, nothing to do (use --force to re-import)`)
      return
    }

    this.logger.success(
      `synced ${result.version}: ${result.champions} champions, ${result.items} items, ` +
        `${result.summonerSpells} summoner spells, ${result.queues} queues`
    )
  }
}
