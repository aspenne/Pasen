import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Append-only rank snapshots, which is what turns a current standing into an LP
 * curve. A row is written only when something actually changed, otherwise an
 * hourly poll would add a row per account per hour forever.
 */
export default class extends BaseSchema {
  protected tableName = 'league_entries'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('riot_account_id').unsigned().notNullable().references('id').inTable('riot_accounts').onDelete('CASCADE')

      // Free text: Riot returns more than solo and flex - RANKED_PREMADE_5x5
      // shows up too - and the list is not ours to close.
      table.string('queue_type', 40).notNullable()
      table.string('tier', 20).nullable()
      table.string('rank', 5).nullable()
      table.integer('league_points').notNullable()
      table.integer('wins').notNullable()
      table.integer('losses').notNullable()
      table.boolean('hot_streak').notNullable().defaultTo(false)

      table.timestamp('captured_at', { useTz: true }).notNullable()

      table.index(['riot_account_id', 'queue_type', 'captured_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
