import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Matches are global and deduplicated by Riot's own id: when four members of the
 * group play together, the match is fetched once and stored once, and each of
 * them finds themselves through match_participants.
 *
 * All ten - or eighteen - participants are stored, not just tracked members.
 * That is what makes "who are they up against", matchup stats and duo detection
 * possible without a second fetch.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('matches', (table) => {
      // 'EUW1_7984945985'. Riot's id, so re-ingesting is idempotent by nature.
      table.string('match_id', 32).primary()
      table.string('platform', 10).notNullable()

      table.integer('queue_id').notNullable()
      // Denormalised from queue id + game mode so filtering a page never has to
      // reimplement the fallback for queue ids Riot has not published.
      table.string('queue_group', 20).notNullable()
      table.string('game_mode', 30).notNullable()
      table.string('game_type', 30).notNullable()
      table.string('game_version', 30).notNullable()

      table.timestamp('game_creation', { useTz: true }).notNullable()
      table.integer('game_duration').notNullable()
      table.timestamp('game_ended_at', { useTz: true }).nullable()

      // Not a constant: 10 on Summoner's Rift, 18 in Arena.
      table.integer('participant_count').notNullable()
      // Customs, bot games and tutorials are stored but kept out of averages.
      table.boolean('stats_eligible').notNullable().defaultTo(true)

      /*
       * The untouched payload. Kept so a stat nobody thought of today can be
       * derived later without re-fetching - which matters because a backfill
       * costs one request per match against 100 requests per two minutes.
       *
       * Deliberately not GIN-indexed: nothing queries inside it (reads go
       * through match_participants), and indexing every key of a 100 KB document
       * would cost write throughput and disk for no read benefit.
       */
      table.jsonb('raw').notNullable()
      table.timestamp('ingested_at', { useTz: true }).notNullable()

      table.index(['game_creation'])
      table.index(['queue_group', 'game_creation'])
    })

    this.schema.createTable('match_participants', (table) => {
      table.string('match_id', 32).notNullable().references('match_id').inTable('matches').onDelete('CASCADE')
      table.string('puuid', 100).notNullable()

      table.integer('team_id').notNullable()
      // Arena only: the two-player subteam and its 1-8 finish.
      table.integer('subteam_id').nullable()
      table.integer('subteam_placement').nullable()

      table.integer('champion_id').notNullable()
      table.string('champion_name', 30).notNullable()
      // Empty outside Summoner's Rift, so nullable rather than a role enum.
      table.string('team_position', 20).nullable()
      table.string('individual_position', 20).nullable()

      table.boolean('win').notNullable()
      table.integer('kills').notNullable()
      table.integer('deaths').notNullable()
      table.integer('assists').notNullable()
      table.integer('gold_earned').notNullable()
      // Lane minions and jungle camps summed: the number players call "CS".
      table.integer('cs').notNullable()
      table.integer('damage_dealt').notNullable()
      table.integer('damage_taken').notNullable()
      table.integer('vision_score').notNullable()
      table.integer('wards_placed').notNullable()
      table.integer('wards_killed').notNullable()
      table.integer('champ_level').notNullable()

      table.integer('summoner1_id').notNullable()
      table.integer('summoner2_id').notNullable()
      table.jsonb('items').notNullable()
      table.jsonb('perks').nullable()

      // Snapshot of the Riot ID at the time of the match, which is how an
      // opponent can be named without ever having been fetched.
      table.string('riot_id_game_name').nullable()
      table.string('riot_id_tag_line').nullable()

      table.integer('double_kills').notNullable().defaultTo(0)
      table.integer('triple_kills').notNullable().defaultTo(0)
      table.integer('quadra_kills').notNullable().defaultTo(0)
      table.integer('penta_kills').notNullable().defaultTo(0)
      table.boolean('first_blood_kill').notNullable().defaultTo(false)
      table.boolean('early_surrender').notNullable().defaultTo(false)

      table.primary(['match_id', 'puuid'])
      // The hot path: one member's history, newest first.
      table.index(['puuid'])
      table.index(['puuid', 'champion_id'])
    })

    this.schema.createTable('match_timelines', (table) => {
      table.string('match_id', 32).primary().references('match_id').inTable('matches').onDelete('CASCADE')
      table.jsonb('raw').notNullable()
      table.timestamp('fetched_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable('match_timelines')
    this.schema.dropTable('match_participants')
    this.schema.dropTable('matches')
  }
}
