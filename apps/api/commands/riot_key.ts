import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

import { riot, riotKeyProvider } from '#riot/service'

/**
 * Stopgap for the admin screen. Development keys expire every 24 hours, so
 * rotating one has to be a single command that needs no redeploy and no restart:
 * the key lives in the database and every process reads it from there.
 */
export default class RiotKey extends BaseCommand {
  static commandName = 'riot:key'
  static description = 'Show, set or verify the Riot API key'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({
    description: 'Action: status, set or check',
    default: 'status',
    required: false,
  })
  declare action: string

  @args.string({
    description: 'The key when setting; a Riot ID like "Name#TAG" when checking',
    required: false,
  })
  declare value?: string

  async run() {
    const provider = riotKeyProvider()

    if (this.action === 'set') {
      if (!this.value) {
        this.logger.error('usage: node ace riot:key set RGAPI-...')
        this.exitCode = 1
        return
      }

      await provider.set(this.value)
      this.logger.success('key stored; every process picks it up on its next call')
    }

    if (this.action === 'check') {
      const [gameName, tagLine] = (this.value ?? '3C Patate Chaude#CCC').split('#')
      if (!gameName || !tagLine) {
        this.logger.error('usage: node ace riot:key check "Name#TAG"')
        this.exitCode = 1
        return
      }

      // A cheap, real call: if this resolves, the key is live and routing works.
      const account = await riot().account.byRiotId(gameName, tagLine, 'euw1')
      this.logger.success(`key is live (resolved ${account.gameName}#${account.tagLine})`)
    }

    const status = await provider.status()
    this.logger.info(
      `hasKey=${status.hasKey} source=${status.source} ` +
        `fingerprint=${status.fingerprint ?? '-'} invalidSince=${status.invalidSince ?? '-'}`
    )
  }
}
