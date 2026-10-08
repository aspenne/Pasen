import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

import { CustomMatchMirror } from '#customs/custom_match_mirror'

/**
 * Rewrites every captured inhouse into the match tables.
 *
 * Uploads, decisions and deletions keep the mirror in step on their own; this
 * is for the customs uploaded before the mirror existed, and for repairing
 * anything that drifted. Safe to run any number of times.
 */
export default class PasenCustoms extends BaseCommand {
  static commandName = 'pasen:customs'
  static description = 'Mirror every captured custom game into the match tables'
  static options: CommandOptions = { startApp: true }

  async run() {
    const { mirrored, removed } = await new CustomMatchMirror().syncAll()
    this.logger.success(
      `${mirrored} inhouse${mirrored === 1 ? '' : 's'} mirrored, ${removed} left out (practice against bots, or no result)`
    )
  }
}
