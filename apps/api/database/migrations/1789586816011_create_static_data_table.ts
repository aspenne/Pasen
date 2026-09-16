import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Data Dragon reference data, mirrored locally so a page render never depends on
 * a third-party CDN being up, and so champion and item names can be joined and
 * aggregated in SQL.
 *
 * Primary keys are Riot's own numeric ids, which is what match payloads carry.
 * Artwork is not stored: the browser loads it straight from the Data Dragon CDN,
 * which costs no API budget and no disk.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('static_champions', (table) => {
      // championId in match-v5. Data Dragon calls it `key` and types it a string.
      table.integer('id').primary()
      // 'Aatrox' - the Data Dragon identifier, used to build CDN asset URLs.
      table.string('slug').notNullable().index()
      table.string('name').notNullable()
      table.string('title').notNullable()
      table.jsonb('tags').notNullable()
      table.string('image').notNullable()
      table.string('version').notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.createTable('static_items', (table) => {
      table.integer('id').primary()
      table.string('name').notNullable()
      table.text('plaintext').nullable()
      table.integer('gold_total').notNullable().defaultTo(0)
      table.string('image').notNullable()
      table.string('version').notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.createTable('static_summoner_spells', (table) => {
      table.integer('id').primary()
      table.string('slug').notNullable()
      table.string('name').notNullable()
      table.string('image').notNullable()
      table.string('version').notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    // Not a Data Dragon file: queues live in Riot's static docs and are not
    // versioned alongside the game client.
    this.schema.createTable('static_queues', (table) => {
      table.integer('queue_id').primary()
      table.string('map').nullable()
      table.string('description').nullable()
      table.text('notes').nullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable('static_queues')
    this.schema.dropTable('static_summoner_spells')
    this.schema.dropTable('static_items')
    this.schema.dropTable('static_champions')
  }
}
