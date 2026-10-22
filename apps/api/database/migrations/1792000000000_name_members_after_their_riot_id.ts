import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Members were named by hand; from here they are named after the in-game
 * name of their main account, and kept in step with it. This brings the
 * existing ones in line once - the account linker and the daily Riot ID
 * check keep them there.
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE members m
        SET display_name = main.game_name
        FROM (
          SELECT DISTINCT ON (a.member_id) a.member_id, a.game_name
          FROM riot_accounts a
          JOIN members mm ON mm.id = a.member_id
          -- The chosen main account first, otherwise the first one added.
          ORDER BY a.member_id, (a.id = mm.main_account_id) DESC, a.id
        ) main
        WHERE main.member_id = m.id AND m.display_name <> main.game_name
      `)
    })
  }

  async down() {
    // The hand-typed names are not kept; there is nothing to go back to.
  }
}
