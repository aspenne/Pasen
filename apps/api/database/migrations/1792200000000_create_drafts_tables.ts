import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A draft - bans and picks, two captains taking turns - and its twenty
 * actions. The step being played is simply how many actions there are.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('drafts', (table) => {
      table.increments('id')
      table.integer('group_id').unsigned().references('id').inTable('groups').onDelete('CASCADE')
      table.integer('fearless_night_id').unsigned().nullable().references('id').inTable('fearless_nights').onDelete('SET NULL')
      // Hashes of the captains' seat tokens; the tokens live in their browsers only.
      table.string('blue_seat', 64).nullable()
      table.string('red_seat', 64).nullable()
      table.integer('hover_champion_id').nullable()
      table.timestamp('step_started_at', { useTz: true }).notNullable()
      table.timestamp('finished_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['group_id', 'created_at'])
    })

    this.schema.createTable('draft_actions', (table) => {
      table.increments('id')
      table.integer('draft_id').unsigned().references('id').inTable('drafts').onDelete('CASCADE')
      table.smallint('step').notNullable()
      table.string('side', 4).notNullable()
      table.string('kind', 4).notNullable()
      table.integer('champion_id').notNullable()
      table.string('role', 8).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      // Two captains clicking at once: the database, not luck, keeps one.
      table.unique(['draft_id', 'step'])
      table.unique(['draft_id', 'champion_id'])
    })
  }

  async down() {
    this.schema.dropTable('draft_actions')
    this.schema.dropTable('drafts')
  }
}
