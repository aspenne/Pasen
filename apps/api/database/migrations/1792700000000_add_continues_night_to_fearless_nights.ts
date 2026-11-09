import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A night can pick up where an earlier one stopped: a fearless series played
 * over several evenings. Only the link is stored; what it carries over is
 * worked out from the earlier night on every read, like the rest of a board.
 */
export default class extends BaseSchema {
  protected tableName = 'fearless_nights'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('continues_night_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('fearless_nights')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('continues_night_id')
    })
  }
}
