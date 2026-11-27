import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Riot's Arena God progress per account: how many different champions it has
 * placed first with. Riot's own count, over the account's whole history, so
 * it is read from challenges-v1 rather than worked out from stored games.
 */
export default class extends BaseSchema {
  protected tableName = 'riot_accounts'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('arena_god').nullable()
      table.timestamp('arena_god_checked_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('arena_god_checked_at')
      table.dropColumn('arena_god')
    })
  }
}
