import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The custom lobby a group is about to play, and the roles drawn on it.
 *
 * A lobby row is a composition: the same players coming back from the capture
 * app refresh it rather than add one, and anything different starts a new
 * lobby - which also starts it without a draw.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('custom_lobbies', (table) => {
      table.increments('id')
      table.integer('group_id').unsigned().references('id').inTable('groups').onDelete('CASCADE')
      table.jsonb('teams').notNullable()
      table.string('source', 8).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['group_id', 'created_at'])
    })
    this.schema.raw(
      `ALTER TABLE custom_lobbies ADD CONSTRAINT custom_lobbies_source_check CHECK (source IN ('capture', 'manual'))`
    )

    this.schema.createTable('role_draws', (table) => {
      table.increments('id')
      table.integer('lobby_id').unsigned().references('id').inTable('custom_lobbies').onDelete('CASCADE')
      table.jsonb('roles').notNullable()
      table.timestamp('reveal_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable('role_draws')
    this.schema.dropTable('custom_lobbies')
  }
}
