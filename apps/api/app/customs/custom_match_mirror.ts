import db from '@adonisjs/lucid/services/db'

import CustomGame from '#models/custom_game'
import Group from '#models/group'
import RiotAccount from '#models/riot_account'
import { CustomGameReader } from '#customs/custom_game_reader'
import { customMatchId, customMatchRows, mirrorable } from '#customs/custom_match_rows'

/**
 * Keeps the match tables in step with the customs table.
 *
 * custom_games stays the source of truth - it holds the capture, the only copy
 * of the game. The mirror is derived from it and rewritten whole whenever
 * anything that changes it changes: an upload, a winner decided by hand, a
 * deletion. Rewritten rather than patched, inside one transaction, so a page
 * never reads half an old game and half a new one.
 */
export class CustomMatchMirror {
  /** Brings one custom into the match tables, or takes it out if it no longer belongs. */
  async sync(game: CustomGame): Promise<'mirrored' | 'removed'> {
    const group = await Group.findOrFail(game.groupId)
    const view = await new CustomGameReader().find(group, game.id)

    if (!view || !mirrorable(view)) {
      await this.remove(game.id)
      return 'removed'
    }

    const accounts = await RiotAccount.query().whereHas('member', (member) =>
      member.whereHas('groups', (groups) => groups.where('groups.id', group.id))
    )
    const puuidByRiotId = new Map(
      accounts.map((account) => [`${account.gameName}#${account.tagLine}`.toLowerCase(), account.puuid])
    )
    const platform = accounts[0]?.platform ?? 'euw1'

    const rows = customMatchRows(view, puuidByRiotId, platform, new Date())

    await db.transaction(async (trx) => {
      // Participants go with the match: the foreign key cascades.
      await trx.from('matches').where('match_id', rows.match.match_id as string).delete()
      await trx.table('matches').insert(rows.match)
      if (rows.participants.length > 0) await trx.table('match_participants').insert(rows.participants)
    })

    return 'mirrored'
  }

  async remove(customGameId: number): Promise<void> {
    await db.from('matches').where('match_id', customMatchId(customGameId)).delete()
  }

  /** Every custom at once - after a deploy that changes the rows, or to repair drift. */
  async syncAll(): Promise<{ mirrored: number; removed: number }> {
    let mirrored = 0
    let removed = 0
    for (const game of await CustomGame.query().orderBy('id')) {
      const outcome = await this.sync(game)
      if (outcome === 'mirrored') mirrored++
      else removed++
    }
    return { mirrored, removed }
  }
}
