import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Small key/value store for runtime configuration that has to change without a
 * redeploy. Its first tenant is the Riot API key: development keys expire every
 * 24 hours, so the admin pastes a fresh one and the worker picks it up.
 */
export default class extends BaseSchema {
  protected tableName = 'settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.string('key').primary()
      table.jsonb('value').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
