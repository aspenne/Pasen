import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'static_runes'

  async up() {
    /*
     * Styles and the runes inside them share one table: a match payload refers
     * to both by the same kind of id, and every screen that draws one draws the
     * other beside it.
     */
    this.schema.createTable(this.tableName, (table) => {
      table.integer('id').primary()
      table.string('kind', 10).notNullable()
      table.string('name').notNullable()
      table.string('slug').notNullable()
      // Path under Data Dragon's unversioned image root, icon included.
      table.string('image').notNullable()
      table.string('version').notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
