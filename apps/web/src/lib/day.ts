import type { FeedMatch } from '@/lib/api'

export type DayStanding = {
  memberSlug: string
  displayName: string
  games: number
  wins: number
  losses: number
  /** Games ended by the early vote after a leaver: counted as played, neither won nor lost. */
  remakes: number
  /** Over the games that were decided; null when every one was a remake. */
  winRate: number | null
  kills: number
  deaths: number
  assists: number
  /** Champions in the order they were first played that day, most played first. */
  champions: { championId: number; championName: string; games: number }[]
  /** LP won or lost that day; null when the scope has none to count. */
  lp: number | null
}

/**
 * Who played on the day and how it went, one line each.
 *
 * Ordered by wins over losses: a 7-3 evening is a better day than a single
 * win, which a plain win rate would rank above it. Ties go to the one who
 * played more, then to the better rate.
 */
export function dayStandings(matches: FeedMatch[], lp?: Record<string, number> | null): DayStanding[] {
  const bySlug = new Map<string, DayStanding & { championGames: Map<number, DayStanding['champions'][number]> }>()

  for (const match of matches) {
    for (const member of match.members) {
      let standing = bySlug.get(member.memberSlug)
      if (!standing) {
        standing = {
          memberSlug: member.memberSlug,
          displayName: member.displayName,
          games: 0,
          wins: 0,
          losses: 0,
          remakes: 0,
          winRate: null,
          kills: 0,
          deaths: 0,
          assists: 0,
          champions: [],
          // A member who played but whose standing did not move is at zero, not unknown.
          lp: lp ? (lp[member.memberSlug] ?? 0) : null,
          championGames: new Map(),
        }
        bySlug.set(member.memberSlug, standing)
      }

      standing.games++
      if (match.remake) standing.remakes++
      else if (member.win) standing.wins++
      else standing.losses++
      standing.kills += member.kills
      standing.deaths += member.deaths
      standing.assists += member.assists

      const champion = standing.championGames.get(member.championId)
      if (champion) champion.games++
      else standing.championGames.set(member.championId, { championId: member.championId, championName: member.championName, games: 1 })
    }
  }

  return [...bySlug.values()]
    .map(({ championGames, ...standing }) => {
      const decided = standing.wins + standing.losses
      return {
        ...standing,
        winRate: decided === 0 ? null : Math.round((standing.wins / decided) * 1000) / 10,
        // Stable sort keeps first-seen order among equals.
        champions: [...championGames.values()].sort((a, b) => b.games - a.games),
      }
    })
    .sort(
      (a, b) =>
        b.wins - b.losses - (a.wins - a.losses) ||
        b.games - a.games ||
        (b.winRate ?? -1) - (a.winRate ?? -1)
    )
}
