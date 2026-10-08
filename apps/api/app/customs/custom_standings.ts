import type { CustomGameView } from '#customs/custom_game_view'

/**
 * Who has won the most customs.
 *
 * Built from the same views the custom pages draw, so a winner decided by hand
 * counts here exactly as it reads there - one rule for the result, applied in
 * one place.
 */
export type CustomStanding = {
  /** A member's slug, or a Riot ID for someone who played but is not tracked. */
  key: string
  memberSlug: string | null
  name: string
  wins: number
  losses: number
  games: number
  winRate: number
}

export type CustomStandings = {
  standings: CustomStanding[]
  /** Games that went into the table. */
  counted: number
  /** Games left out, and why - shown so an empty table is never a mystery. */
  skipped: { againstBots: number; unknownResult: number }
}

export function customStandings(games: CustomGameView[]): CustomStandings {
  const table = new Map<string, CustomStanding>()
  let counted = 0
  let againstBots = 0
  let unknownResult = 0

  for (const game of games) {
    /*
     * Practice against bots is not a win over anyone. Left out entirely,
     * rather than counted for the one human in it.
     */
    if (game.againstBots) {
      againstBots++
      continue
    }

    // No GameEnd in the capture and nobody decided: there is no winner to credit.
    if (!game.resultKnown) {
      unknownResult++
      continue
    }

    counted++

    for (const team of game.teams) {
      for (const player of team.players) {
        if (player.isBot) continue

        /*
         * A member is one row however many accounts they played on; anyone
         * else is keyed by Riot ID, so a friend who is not on the roster still
         * gets their line.
         */
        const key = player.memberSlug ?? player.riotId.toLowerCase()
        const row = table.get(key) ?? {
          key,
          memberSlug: player.memberSlug,
          name: player.displayName ?? player.name,
          wins: 0,
          losses: 0,
          games: 0,
          winRate: 0,
        }

        row.games++
        if (team.won) row.wins++
        else row.losses++
        table.set(key, row)
      }
    }
  }

  const standings = [...table.values()]
    .map((row) => ({ ...row, winRate: Math.round((row.wins / row.games) * 1000) / 10 }))
    /*
     * Most wins first, as asked. Ties go to the better rate, then to whoever
     * needed fewer games for it - five wins in six beats five in twelve.
     */
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.winRate - a.winRate ||
        a.games - b.games ||
        a.name.localeCompare(b.name)
    )

  return { standings, counted, skipped: { againstBots, unknownResult } }
}
