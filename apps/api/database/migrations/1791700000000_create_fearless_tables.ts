import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A fearless night: a window of time, and what the admin corrected in it.
 *
 * The burned champions are not stored. They are worked out from the customs
 * whose end falls in the window, so a custom sent late or deleted is accounted
 * for on the next read.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('fearless_nights', (table) => {
      table.increments('id')
      table.integer('group_id').unsigned().references('id').inTable('groups').onDelete('CASCADE')
      table.string('label', 80).nullable()
      table.timestamp('started_at', { useTz: true }).notNullable()
      table.timestamp('ended_at', { useTz: true }).nullable()
      table.jsonb('excluded_custom_ids').notNullable().defaultTo('[]')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['group_id', 'started_at'])
    })

    this.schema.createTable('fearless_adjustments', (table) => {
      table.increments('id')
      table
        .integer('night_id')
        .unsigned()
        .references('id')
        .inTable('fearless_nights')
        .onDelete('CASCADE')
      table.integer('champion_id').notNullable()
      table.string('kind', 8).notNullable()
      table.timestamp('decided_at', { useTz: true }).notNullable()
      table.unique(['night_id', 'champion_id'])
    })

    this.schema.raw(
      `ALTER TABLE fearless_adjustments ADD CONSTRAINT fearless_adjustments_kind_check CHECK (kind IN ('burn', 'free'))`
    )
  }

  async down() {
    this.schema.dropTable('fearless_adjustments')
    this.schema.dropTable('fearless_nights')
  }
}
