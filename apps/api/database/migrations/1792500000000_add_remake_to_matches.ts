import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A remake - the vote to end a game in its first minutes, after a leaver - is
 * neither a win nor a loss: Riot gives no LP for it and takes none. Riot still
 * marks one side as having won, so counted naively it reads as a defeat for
 * whoever voted. It is flagged here and kept out of every average, the way
 * customs and bot games already are.
 *
 * The games already stored are classified from their raw payload, where Riot
 * sets `gameEndedInEarlySurrender` on every participant of a remake.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('matches', (table) => {
      table.boolean('remake').notNullable().defaultTo(false)
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE matches
        SET remake = true, stats_eligible = false
        WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(raw->'info'->'participants') AS p
          WHERE (p->>'gameEndedInEarlySurrender')::boolean
        )
      `)
    })
  }

  async down() {
    // stats_eligible is left as it is: a remake is not a game to average either way.
    this.schema.alterTable('matches', (table) => {
      table.dropColumn('remake')
    })
  }
}
