import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sent_notifications'

  async up() {
    /*
     * One row per thing we have already announced.
     *
     * A match is ingested once per member who was in it, so a five-stack with a
     * pentakill would otherwise post five identical messages; the worker also
     * restarts, and rank snapshots re-run. The key is derived from the event
     * itself, and the primary key is what makes a second attempt a no-op.
     */
    this.schema.createTable(this.tableName, (table) => {
      table.string('key', 190).primary()
      table.string('kind', 30).notNullable()
      table.timestamp('sent_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
