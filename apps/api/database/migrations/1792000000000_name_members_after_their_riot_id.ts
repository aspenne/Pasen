import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Members were named by hand; from here they are named after the in-game
 * name of their first account, and kept in step with it. This brings the
 * existing ones in line once - the account linker and the daily Riot ID
 * check keep them there.
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE members m
        SET display_name = first.game_name
        FROM (
          SELECT DISTINCT ON (member_id) member_id, game_name
          FROM riot_accounts
          ORDER BY member_id, id
        ) first
        WHERE first.member_id = m.id AND m.display_name <> first.game_name
      `)
    })
  }

  async down() {
    // The hand-typed names are not kept; there is nothing to go back to.
  }
}
