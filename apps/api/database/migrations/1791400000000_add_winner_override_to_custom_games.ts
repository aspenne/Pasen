import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A winner decided by hand.
 *
 * The capture only knows the result from the point of view of whoever ran the
 * agent, and knows nothing at all when it was saved from the window closing.
 * So a person can settle it - and their answer is kept apart from the capture
 * rather than written into `raw`, which stays exactly as the agent saved it.
 */
export default class extends BaseSchema {
  protected tableName = 'custom_games'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('winner_override', 5).nullable()
    })

    this.schema.raw(
      `ALTER TABLE custom_games ADD CONSTRAINT custom_games_winner_override_side
       CHECK (winner_override IS NULL OR winner_override IN ('ORDER', 'CHAOS'))`
    )
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('winner_override')
    })
  }
}
