import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'

import { DiscordService } from '#notifications/discord_service'

/**
 * Sets, shows or tries the Discord webhook.
 *
 * The URL is a secret in the same sense the Riot key is: anyone holding it can
 * post to the channel. It lives in the database, never in the repository, and
 * is never printed back.
 */
export default class PasenDiscord extends BaseCommand {
  static commandName = 'pasen:discord'
  static description = 'Configure or test the Discord webhook'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Action: status, set or test', default: 'status', required: false })
  declare action: string

  @args.string({ description: 'The webhook URL when setting', required: false })
  declare value?: string

  async run() {
    const discord = new DiscordService()

    if (this.action === 'set') {
      if (!this.value) {
        this.logger.error('usage: node ace pasen:discord set https://discord.com/api/webhooks/...')
        this.exitCode = 1
        return
      }

      try {
        await discord.setWebhookUrl(this.value)
        this.logger.success('webhook stored')
      } catch (error) {
        this.logger.error(error instanceof Error ? error.message : String(error))
        this.exitCode = 1
      }
      return
    }

    if (this.action === 'test') {
      const sent = await discord.announce({
        // Stamped, so a second test is a second message rather than a no-op.
        key: `test:${DateTime.utc().toISO()}`,
        kind: 'streak',
        text: 'Pasen is connected to this channel.',
      })

      this.logger[sent ? 'success' : 'error'](
        sent ? 'message sent' : 'nothing sent — check the webhook and the logs'
      )
      if (!sent) this.exitCode = 1
      return
    }

    const url = await discord.webhookUrl()
    this.logger.info(url ? 'a webhook is configured' : 'no webhook configured')
  }
}
