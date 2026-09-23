import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { isPlatform } from '@pasen/shared'
import db from '@adonisjs/lucid/services/db'

import { riot } from '#riot/service'

/**
 * Resolves a puuid to whoever holds it today.
 *
 * Riot IDs change; puuids do not. Every participant of every stored match
 * carries one, so this answers "who is this now" for a player who has renamed
 * since we last saw them - and names the regulars a group keeps meeting.
 *
 * It can fail on an identifier stored under an older API key, since Riot
 * encrypts puuids per key and will not decrypt one minted under another.
 */
export default class PasenWhois extends BaseCommand {
  static commandName = 'pasen:whois'
  static description = 'Resolve a stored puuid, or an old Riot ID, to its current owner'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'A puuid, or a Riot ID we saw before, like "SOUMIS#CAM"' })
  declare subject: string

  @args.string({ description: 'Platform, e.g. euw1', required: false })
  declare platform?: string

  async run() {
    const platform = this.platform ?? 'euw1'
    if (!isPlatform(platform)) {
      this.logger.error(`unknown platform "${platform}"`)
      this.exitCode = 1
      return
    }

    let puuid = this.subject
    let seenAs: string | null = null

    if (this.subject.includes('#')) {
      const [gameName, tagLine] = this.subject.split('#')
      const row = await db
        .from('match_participants as p')
        .join('matches as m', 'm.match_id', 'p.match_id')
        .where('p.riot_id_game_name', gameName)
        .andWhere('p.riot_id_tag_line', tagLine)
        .orderBy('m.ingested_at', 'desc')
        .select('p.puuid', 'm.ingested_at')
        .first()

      if (!row) {
        this.logger.error(`never seen ${this.subject} in a stored match`)
        this.exitCode = 1
        return
      }

      puuid = row.puuid
      seenAs = this.subject
      this.logger.info(
        `last stored ${new Date(row.ingested_at).toISOString().slice(0, 16).replace('T', ' ')}`
      )
    }

    try {
      const account = await riot().account.byPuuid(puuid, platform)
      const now = `${account.gameName}#${account.tagLine}`

      if (seenAs && now !== seenAs) {
        this.logger.success(`${seenAs} is now ${now}`)
      } else {
        this.logger.success(now)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(message)
      // The one failure worth explaining, because it is not about the player.
      if (message.includes('decrypting')) {
        this.logger.info(
          'that puuid was stored under an older API key, so Riot can no longer read it'
        )
      }
      this.exitCode = 1
    }
  }
}
