import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The PCs allowed to send captured customs straight to the site.
 *
 * A device holds a token that can do exactly one thing - upload a custom to
 * one group - and only its hash is kept here. Revoking sets a date rather than
 * deleting the row, so the admin list can still say which PC it was and when
 * it last sent anything.
 */
export default class extends BaseSchema {
  protected tableName = 'capture_devices'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('group_id').unsigned().references('id').inTable('groups').onDelete('CASCADE')
      table.string('name', 60).notNullable()
      table.string('token_hash', 64).notNullable().unique()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('last_used_at', { useTz: true }).nullable()
      table.timestamp('revoked_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
