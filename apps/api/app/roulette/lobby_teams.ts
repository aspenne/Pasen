/**
 * The two sides of a custom lobby as Pasen keeps them. Whatever arrives - from
 * the capture app or the admin's editor - goes through `normaliseTeams` first,
 * so the rest of the roulette can trust the shape.
 */
export type Seat = {
  /** Null for a bot, which has no Riot account. */
  puuid: string | null
  name: string
  bot: boolean
}

export type Side = 'blue' | 'red'
export type Teams = Record<Side, Seat[]>

/** A League team has five places; anything past them is not a player in this game. */
export const TEAM_SIZE = 5
const NAME_LENGTH = 40

export class InvalidTeamsError extends Error {}

export function normaliseTeams(input: unknown): Teams {
  if (!input || typeof input !== 'object') throw new InvalidTeamsError('Teams must be an object.')
  const raw = input as Record<string, unknown>

  const side = (key: Side): Seat[] => {
    const list = raw[key]
    if (!Array.isArray(list)) throw new InvalidTeamsError(`The ${key} side must be a list.`)
    return list.slice(0, TEAM_SIZE).map((entry) => {
      const seat = (entry ?? {}) as Record<string, unknown>
      const bot = seat.bot === true
      const name = String(seat.name ?? '').trim().slice(0, NAME_LENGTH)
      const puuid = !bot && typeof seat.puuid === 'string' && seat.puuid ? seat.puuid : null
      return { puuid, name: name || (bot ? 'Bot' : 'Player'), bot }
    })
  }

  return { blue: side('blue'), red: side('red') }
}

/** Same players in the same places: an unchanged lobby is not a new one. */
export function sameTeams(a: Teams, b: Teams): boolean {
  const key = (teams: Teams) =>
    JSON.stringify(
      (['blue', 'red'] as const).map((side) => teams[side].map((seat) => [seat.puuid, seat.name, seat.bot]))
    )
  return key(a) === key(b)
}
