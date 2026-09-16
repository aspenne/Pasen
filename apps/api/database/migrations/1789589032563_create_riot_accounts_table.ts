import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One Riot account, owned by a member. A person with a smurf has several rows
 * here and their stats aggregate over all of them.
 *
 * No summonerId column: Riot removed the endpoints keyed on it on 2025-06-20,
 * and the puuid is now the only identifier worth storing.
 */
export default class extends BaseSchema {
  protected tableName = 'riot_accounts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('member_id').unsigned().notNullable().references('id').inTable('members').onDelete('CASCADE')

      // Globally unique, and the join key against match_participants.
      table.string('puuid', 100).notNullable().unique()
      // Riot IDs change; these are a cache refreshed on sync, not an identity.
      table.string('game_name').notNullable()
      table.string('tag_line').notNullable()
      // Platform, not region: euw1, na1, kr. The regional cluster derives from it.
      table.string('platform', 10).notNullable()

      table.integer('profile_icon_id').nullable()
      table.integer('summoner_level').nullable()

      /*
       * Sync frontiers, as timestamps rather than page offsets. Paging by
       * `start` breaks whenever a new game is played mid-backfill, because every
       * older match shifts down a slot and one gets skipped.
       */
      // Newest match ingested. Incremental sync asks Riot for anything after it.
      table.timestamp('synced_to', { useTz: true }).nullable()
      // Oldest match ingested. The backfill walks this backwards.
      table.timestamp('synced_from', { useTz: true }).nullable()
      // Where the backfill stops: start of the current season by default.
      table.timestamp('backfill_target', { useTz: true }).nullable()
      table.string('backfill_state').notNullable().defaultTo('pending')
      table.text('backfill_error').nullable()

      table.timestamp('last_synced_at', { useTz: true }).nullable()
      // Lets the live poller notice a game just ended and sync it immediately.
      table.timestamp('last_seen_live_at', { useTz: true }).nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['backfill_state'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
