import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import { isStatsEligible, queueGroupFor } from '@pasen/shared'

/**
 * Recomputes queue_group and stats_eligible from the stored payload.
 *
 * Both are denormalised at ingestion, so a match keeps whatever classification
 * was current the day it arrived. When the queue map learns something new - and
 * it does, because Riot serves queue ids it never publishes - older rows keep
 * the old answer and the same queue ends up in two groups at once.
 *
 * This is what the raw payload is for: the correction needs no Riot request.
 */
export default class MatchesReclassify extends BaseCommand {
  static commandName = 'matches:reclassify'
  static description = 'Recompute queue grouping for stored matches from their payloads'
  static options: CommandOptions = { startApp: true }

  @flags.boolean({ description: 'Report what would change without writing' })
  declare dryRun: boolean

  async run() {
    const rows = await db
      .from('matches')
      .select('match_id', 'queue_id', 'game_mode', 'queue_group', 'stats_eligible')

    const changes: { matchId: string; from: string; to: string }[] = []

    for (const row of rows) {
      const group = queueGroupFor(row.queue_id, row.game_mode)
      const eligible = isStatsEligible(row.queue_id, row.game_mode)

      if (group === row.queue_group && eligible === row.stats_eligible) {
        continue
      }

      changes.push({ matchId: row.match_id, from: row.queue_group, to: group })

      if (!this.dryRun) {
        await db
          .from('matches')
          .where('match_id', row.match_id)
          .update({ queue_group: group, stats_eligible: eligible })
      }
    }

    if (changes.length === 0) {
      this.logger.success(`${rows.length} matches checked, every one already correct`)
      return
    }

    const byMove = new Map<string, number>()
    for (const change of changes) {
      const key = `${change.from} -> ${change.to}`
      byMove.set(key, (byMove.get(key) ?? 0) + 1)
    }

    for (const [move, count] of [...byMove].sort((a, b) => b[1] - a[1])) {
      this.logger.info(`  ${move}: ${count}`)
    }

    this.logger[this.dryRun ? 'info' : 'success'](
      `${changes.length} of ${rows.length} matches ${this.dryRun ? 'would be' : ''} reclassified`
    )
  }
}
