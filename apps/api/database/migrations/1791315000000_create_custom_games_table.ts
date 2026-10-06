import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Custom games, which exist nowhere else.
 *
 * Riot's match API does not serve them, and the client's Live Client Data API
 * is gone the moment the game window closes - so unlike every other table
 * here, this one cannot be rebuilt from Riot if it is lost. The whole capture
 * is therefore kept verbatim in `raw`, and the columns beside it are only the
 * handful we need to list and sort without opening the blob.
 */
export default class extends BaseSchema {
  protected tableName = 'custom_games'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('group_id').unsigned().references('id').inTable('groups').onDelete('CASCADE')

      /*
       * The capture carries no game id, so the payload is its own identity:
       * uploading the same file twice is caught here rather than by whoever
       * notices the duplicate three weeks later.
       */
      table.string('fingerprint', 64).notNullable().unique()

      table.timestamp('played_at', { useTz: true }).notNullable()
      table.integer('duration').notNullable()
      table.string('game_mode', 40).notNullable()
      table.string('map_name', 60).nullable()
      table.integer('player_count').notNullable()
      table.string('label', 80).nullable()

      table.jsonb('raw').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.index(['group_id', 'played_at'], 'custom_games_group_played_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
