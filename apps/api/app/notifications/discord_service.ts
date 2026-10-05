import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'

import SentNotification from '#models/sent_notification'
import Setting from '#models/setting'

const WEBHOOK_SETTING = 'discord.webhook_url'

export type Announcement = {
  /**
   * Derived from the event, never from the moment: the same pentakill found by
   * five members' syncs must produce one key, not five.
   */
  key: string
  kind: 'promotion' | 'demotion' | 'pentakill' | 'streak' | 'decay'
  text: string
}

/**
 * Posts to a Discord channel, once per thing worth saying.
 *
 * Two rules decide whether this is usable or unbearable. It never says the same
 * thing twice, because a match is ingested once per member who was in it. And
 * it never breaks what called it: a channel being unreachable must not fail an
 * ingest or a rank snapshot, so every failure here is logged and swallowed.
 */
export class DiscordService {
  async webhookUrl(): Promise<string | null> {
    const setting = await Setting.find(WEBHOOK_SETTING)
    const value = (setting?.value as string | undefined)?.trim()
    return value || null
  }

  async setWebhookUrl(url: string): Promise<void> {
    const trimmed = url.trim()
    if (!/^https:\/\/discord(app)?\.com\/api\/webhooks\//.test(trimmed)) {
      throw new Error('That is not a Discord webhook URL')
    }
    await Setting.updateOrCreate({ key: WEBHOOK_SETTING }, { value: trimmed })
  }

  /** True when the message went out; false when it was a duplicate or muted. */
  async announce(announcement: Announcement): Promise<boolean> {
    const url = await this.webhookUrl()
    if (!url) return false

    /*
     * Claimed before posting, not after. Two workers racing on the same event
     * both try to insert, one loses on the primary key, and only the winner
     * speaks - whereas claiming afterwards would let both post first.
     */
    try {
      await SentNotification.create({
        key: announcement.key,
        kind: announcement.kind,
        sentAt: DateTime.utc(),
      })
    } catch {
      return false
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: announcement.text }),
      })

      if (!response.ok) {
        logger.warn(
          { status: response.status, kind: announcement.kind },
          'discord refused the message'
        )
        return false
      }

      return true
    } catch (error) {
      // Never let a silent channel break an ingest or a rank snapshot.
      logger.warn(
        { err: error instanceof Error ? error.message : String(error), kind: announcement.kind },
        'could not reach discord'
      )
      return false
    }
  }
}
