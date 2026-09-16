import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

import RiotAccount from '#models/riot_account'
import { MatchSyncService } from '#ingestion/match_sync_service'
import { riot } from '#riot/service'

/**
 * Manual driver for what the worker will do on a schedule. Useful on its own for
 * kicking a stuck account without waiting for the next cycle.
 */
export default class PasenSync extends BaseCommand {
  static commandName = 'pasen:sync'
  static description = 'Sync recent matches, or run backfill steps, for tracked accounts'
  static options: CommandOptions = { startApp: true }

  @flags.boolean({ description: 'Walk history backwards instead of pulling recent games' })
  declare backfill: boolean

  @flags.string({ description: 'Limit to one Riot ID, e.g. "Name#TAG"' })
  declare account?: string

  @flags.number({ description: 'Backfill steps to run per account', default: 1 })
  declare steps: number

  @flags.number({ description: 'Match detail fetches allowed per step', default: 40 })
  declare budget: number

  async run() {
    const query = RiotAccount.query()
    if (this.account) {
      const [gameName, tagLine] = this.account.split('#')
      query.where('game_name', gameName).andWhere('tag_line', tagLine)
    }
    if (this.backfill) {
      query.whereNot('backfill_state', 'done')
    }

    const accounts = await query
    if (accounts.length === 0) {
      this.logger.info('no accounts to sync')
      return
    }

    const service = new MatchSyncService(riot())

    for (const account of accounts) {
      if (!this.backfill) {
        const outcome = await service.syncRecent(account, { maxFetches: this.budget })
        this.logger.info(
          `${account.riotId}: listed ${outcome.listed}, already stored ${outcome.alreadyStored}, ` +
            `ingested ${outcome.ingested}`
        )
        continue
      }

      for (let step = 0; step < this.steps; step++) {
        const outcome = await service.backfillStep(account, { maxFetches: this.budget })
        this.logger.info(
          `${account.riotId} step ${step + 1}: listed ${outcome.listed}, ` +
            `already stored ${outcome.alreadyStored}, ingested ${outcome.ingested}` +
            (outcome.complete ? ' (complete)' : '')
        )
        if (outcome.complete) break
      }
    }
  }
}
