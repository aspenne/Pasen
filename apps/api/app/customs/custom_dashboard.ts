import type { CustomGameView, Side } from '#customs/custom_game_view'
import { identityOf } from '#customs/custom_standings'

/**
 * Stats across every inhouse the group has captured.
 *
 * Only what a Live Client capture carries - kills, deaths, assists, CS, ward
 * score, champions, multikills, first blood, sides - because there is nothing
 * else to read: the client does not report gold or damage for all ten players.
 *
 * Two populations, on purpose. Performance counts every inhouse, whether or
 * not anyone knows who won: the kills still happened. Anything about winning -
 * sides, champions' win rates, duos - counts only the games with a result.
 */
export type PlayerLine = {
  key: string
  memberSlug: string | null
  name: string
  games: number
  kills: number
  deaths: number
  assists: number
  kda: number
  killsPerGame: number
  deathsPerGame: number
  assistsPerGame: number
  csPerMinute: number
  visionPerGame: number
  firstBloods: number
  bestMultikill: number
}

export type RecordLine = {
  kind: 'kills' | 'assists' | 'deaths' | 'cs'
  value: number
  key: string
  memberSlug: string | null
  name: string
  championId: number
  championName: string
  gameId: number
  gameLabel: string | null
}

export type ChampionLine = {
  championId: number
  championName: string
  games: number
  /** Null when none of its games has a known result. */
  winRate: number | null
  /** How many different people picked it - a champion one person spams is not a meta. */
  players: number
}

export type DuoLine = {
  a: { key: string; memberSlug: string | null; name: string }
  b: { key: string; memberSlug: string | null; name: string }
  games: number
  wins: number
  winRate: number
}

export type CustomDashboard = {
  /** Inhouses in the stats: every captured custom that is not practice against bots. */
  counted: number
  /** Of those, how many have a known winner. */
  resolved: number
  overview: {
    kills: number
    /** Seconds. */
    averageDuration: number
    blueWins: number
    redWins: number
  }
  players: PlayerLine[]
  records: RecordLine[]
  champions: ChampionLine[]
  duos: DuoLine[]
}

/** Two games together is the least that is not just coincidence. */
const DUO_MINIMUM = 2

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function customDashboard(games: CustomGameView[]): CustomDashboard {
  // Practice against bots is not an inhouse, and its numbers would flatter everyone.
  const inhouses = games.filter((game) => !game.againstBots)
  const resolved = inhouses.filter((game) => game.resultKnown)

  const players = new Map<
    string,
    Omit<PlayerLine, 'kda' | 'killsPerGame' | 'deathsPerGame' | 'assistsPerGame' | 'csPerMinute' | 'visionPerGame'> & {
      cs: number
      seconds: number
      vision: number
    }
  >()
  const records = new Map<RecordLine['kind'], RecordLine>()
  const champions = new Map<number, { line: ChampionLine; resolved: number; wins: number; pickers: Set<string> }>()
  const duos = new Map<string, DuoLine>()

  let kills = 0
  let seconds = 0
  let blueWins = 0
  let redWins = 0

  for (const game of inhouses) {
    seconds += game.duration
    const winner: Side | null = game.teams.find((team) => team.won)?.side ?? null
    if (game.resultKnown && winner === 'ORDER') blueWins++
    if (game.resultKnown && winner === 'CHAOS') redWins++

    for (const team of game.teams) {
      kills += team.kills
      const humans = team.players.filter((player) => !player.isBot)

      for (const player of humans) {
        const who = identityOf(player)
        const line = players.get(who.key) ?? {
          ...who,
          games: 0,
          kills: 0,
          deaths: 0,
          assists: 0,
          cs: 0,
          seconds: 0,
          vision: 0,
          firstBloods: 0,
          bestMultikill: 0,
        }

        line.games++
        line.kills += player.kills
        line.deaths += player.deaths
        line.assists += player.assists
        line.cs += player.cs
        line.seconds += game.duration
        line.vision += player.wardScore
        line.bestMultikill = Math.max(line.bestMultikill, player.bestMultikill)
        // First blood names a human by game name, which is what `name` holds.
        if (game.firstBlood && game.firstBlood === player.name) line.firstBloods++
        players.set(who.key, line)

        /*
         * Records keep the first game to reach a value: an equal score later
         * does not take a record away from whoever set it.
         */
        for (const kind of ['kills', 'assists', 'deaths', 'cs'] as const) {
          const value = player[kind]
          const held = records.get(kind)
          if (value > 0 && (!held || value > held.value)) {
            records.set(kind, {
              kind,
              value,
              ...who,
              championId: player.championId,
              championName: player.championName,
              gameId: game.id,
              gameLabel: game.label,
            })
          }
        }

        const champion = champions.get(player.championId) ?? {
          line: {
            championId: player.championId,
            championName: player.championName,
            games: 0,
            winRate: null,
            players: 0,
          },
          resolved: 0,
          wins: 0,
          pickers: new Set<string>(),
        }
        champion.line.games++
        champion.pickers.add(who.key)
        if (game.resultKnown) {
          champion.resolved++
          if (team.won) champion.wins++
        }
        champions.set(player.championId, champion)
      }

      // Duos: every pair of humans on the same side of a game with a result.
      if (!game.resultKnown) continue
      for (let i = 0; i < humans.length; i++) {
        for (let j = i + 1; j < humans.length; j++) {
          const [a, b] = [identityOf(humans[i]), identityOf(humans[j])].sort((x, y) =>
            x.key < y.key ? -1 : 1
          )
          const key = `${a.key}|${b.key}`
          const duo = duos.get(key) ?? { a, b, games: 0, wins: 0, winRate: 0 }
          duo.games++
          if (team.won) duo.wins++
          duos.set(key, duo)
        }
      }
    }
  }

  return {
    counted: inhouses.length,
    resolved: resolved.length,
    overview: {
      kills,
      averageDuration: inhouses.length ? Math.round(seconds / inhouses.length) : 0,
      blueWins,
      redWins,
    },
    players: [...players.values()]
      .map(({ cs, seconds: played, vision, ...line }) => ({
        ...line,
        kda: round((line.kills + line.assists) / Math.max(1, line.deaths), 2),
        killsPerGame: round(line.kills / line.games),
        deathsPerGame: round(line.deaths / line.games),
        assistsPerGame: round(line.assists / line.games),
        csPerMinute: played > 0 ? round(cs / (played / 60)) : 0,
        visionPerGame: round(vision / line.games),
      }))
      .sort((a, b) => b.games - a.games || b.kda - a.kda),
    records: (['kills', 'assists', 'deaths', 'cs'] as const)
      .map((kind) => records.get(kind))
      .filter((record): record is RecordLine => record !== undefined),
    champions: [...champions.values()]
      .map(({ line, resolved: decided, wins, pickers }) => ({
        ...line,
        winRate: decided > 0 ? round((wins / decided) * 100) : null,
        players: pickers.size,
      }))
      .sort((a, b) => b.games - a.games || b.players - a.players || a.championName.localeCompare(b.championName))
      .slice(0, 10),
    duos: [...duos.values()]
      .filter((duo) => duo.games >= DUO_MINIMUM)
      .map((duo) => ({ ...duo, winRate: round((duo.wins / duo.games) * 100) }))
      .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || a.games - b.games)
      .slice(0, 5),
  }
}
