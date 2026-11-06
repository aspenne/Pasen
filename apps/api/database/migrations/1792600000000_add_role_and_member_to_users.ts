import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // A new account is a member; only an admin makes another one an admin.
      table.string('role', 16).notNullable().defaultTo('member')
      table
        .integer('member_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('members')
        .onDelete('SET NULL')
    })

    // Every account so far was made by admin:create, and was the admin.
    this.defer(async (db) => {
      await db.from(this.tableName).update({ role: 'admin' })
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('member_id')
      table.dropColumn('role')
    })
  }
}
