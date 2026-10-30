import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * What an item or a rune does, as plain text, for the tooltips on the
 * scoreboard. Empty until the next Data Dragon import: run
 * `node ace static:sync --force` after migrating rather than waiting a patch.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('static_items', (table) => {
      table.text('description').nullable()
    })
    this.schema.alterTable('static_runes', (table) => {
      table.text('description').nullable()
    })
  }

  async down() {
    this.schema.alterTable('static_items', (table) => {
      table.dropColumn('description')
    })
    this.schema.alterTable('static_runes', (table) => {
      table.dropColumn('description')
    })
  }
}
