import { BaseSchema } from '@adonisjs/lucid/schema'

/** The lanes each champion is played in, for filtering champion grids by role. */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('static_champions', (table) => {
      table.jsonb('positions').notNullable().defaultTo('[]')
    })
  }

  async down() {
    this.schema.alterTable('static_champions', (table) => {
      table.dropColumn('positions')
    })
  }
}
