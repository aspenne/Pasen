import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One draft at a time per group, held by the database: two people pressing
 * New draft at the same moment must not leave an orphan open forever.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`CREATE UNIQUE INDEX drafts_one_open_per_group ON drafts (group_id) WHERE finished_at IS NULL`)
    this.schema.raw(`CREATE INDEX draft_actions_draft_id ON draft_actions (draft_id)`)
  }

  async down() {
    this.schema.raw(`DROP INDEX IF EXISTS drafts_one_open_per_group`)
    this.schema.raw(`DROP INDEX IF EXISTS draft_actions_draft_id`)
  }
}
