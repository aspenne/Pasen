import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The account a member is named after. Chosen in the admin; null means their
 * first account. Set here to whichever account already carries the name the
 * member is shown by, so nobody's name changes the day members start following
 * their Riot ID.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('members', (table) => {
      table
        .integer('main_account_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('riot_accounts')
        .onDelete('SET NULL')
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE members m
        SET main_account_id = match.id
        FROM (
          SELECT DISTINCT ON (a.member_id) a.member_id, a.id
          FROM riot_accounts a
          JOIN members mm ON mm.id = a.member_id
          WHERE lower(a.game_name) = lower(mm.display_name)
          ORDER BY a.member_id, a.id
        ) match
        WHERE match.member_id = m.id
      `)
    })
  }

  async down() {
    this.schema.alterTable('members', (table) => {
      table.dropColumn('main_account_id')
    })
  }
}
