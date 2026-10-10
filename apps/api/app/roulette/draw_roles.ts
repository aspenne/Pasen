import { TEAM_SIZE, type Teams } from '#roulette/lobby_teams'

/** The five roles, in the order every team is laid out: lane opponents face each other. */
export const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const
export type Role = (typeof ROLES)[number]

/** Per side, one entry per role (in ROLES order): the index of the seat that plays it, or null. */
export type RoleDraw = { blue: (number | null)[]; red: (number | null)[] }

/**
 * Deals the roles at random within each team. A Fisher-Yates shuffle of the
 * five places, so every assignment is equally likely; a short team leaves
 * the roles nobody drew empty. `random` is injected so a draw can be tested.
 */
export function drawRoles(teams: Teams, random: () => number = Math.random): RoleDraw {
  const deal = (count: number) => {
    const places: (number | null)[] = Array.from({ length: TEAM_SIZE }, (_, i) => (i < count ? i : null))
    for (let i = places.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[places[i], places[j]] = [places[j], places[i]]
    }
    return places
  }
  return { blue: deal(teams.blue.length), red: deal(teams.red.length) }
}
