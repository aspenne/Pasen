import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Riot's own decay flag, which the gateway has been receiving and discarding
 * since the first snapshot. It carries no countdown - that has to be derived
 * from match history - but it is the authoritative answer to "is this standing
 * decaying right now", and the one thing that can contradict our estimate.
 */
export default class extends BaseSchema {
  protected tableName = 'league_entries'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('inactive').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('inactive')
    })
  }
}
