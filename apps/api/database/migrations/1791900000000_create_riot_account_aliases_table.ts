import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Every Riot ID an account has gone by. Riot keeps a player on one puuid
 * through a rename, so ranked history follows on its own; what does not is
 * anything Pasen only ever knew by name - a captured custom names players,
 * nothing more. Remembering the old names keeps those games theirs.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('riot_account_aliases', (table) => {
      table.increments('id')
      table
        .integer('riot_account_id')
        .unsigned()
        .references('id')
        .inTable('riot_accounts')
        .onDelete('CASCADE')
      table.string('game_name', 32).notNullable()
      table.string('tag_line', 8).notNullable()
      table.string('source', 8).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
    })
    this.schema.raw(
      `ALTER TABLE riot_account_aliases ADD CONSTRAINT riot_account_aliases_source_check CHECK (source IN ('riot', 'manual'))`
    )
    // One row per name per account, whatever the case it was typed in.
    this.schema.raw(
      `CREATE UNIQUE INDEX riot_account_aliases_unique ON riot_account_aliases (riot_account_id, lower(game_name), lower(tag_line))`
    )
  }

  async down() {
    this.schema.dropTable('riot_account_aliases')
  }
}
