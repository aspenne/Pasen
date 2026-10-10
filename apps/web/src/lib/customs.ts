import type { QueueScope } from '@pasen/shared'

import type { CustomGame, CustomStanding } from '@/lib/api'

/** The site-wide filter that shows customs only. */
export const CUSTOM_SCOPE: QueueScope = 'custom'

/**
 * The side that won, or an honest blank when the capture ended without
 * saying - shared by every place that lists customs, so they never disagree.
 */
export function customResult(game: CustomGame): { text: string; tone: string } {
  const winner = game.teams.find((team) => team.won)
  if (!game.resultKnown || !winner) return { text: 'Result not captured', tone: 'text-ink-dim' }
  return {
    text: winner.side === 'ORDER' ? 'Blue side won' : 'Red side won',
    tone: winner.side === 'ORDER' ? 'text-win' : 'text-loss',
  }
}

/** What a custom is called when nobody named it at upload. */
export function customTitle(game: CustomGame): string {
  return game.label ?? `Custom · ${game.mapName ?? game.gameMode}`
}

/** The custom behind a mirrored match id ("CUSTOM_12"), or null for a Riot game. */
export function customGameIdOf(matchId: string): string | null {
  const match = /^CUSTOM_(\d+)$/.exec(matchId)
  return match ? match[1] : null
}

/**
 * Shared places for a real tie. Five players on the same record shown as
 * 1 to 5 states an order that only the alphabet decided; "1" for all five,
 * then 6, is what a table of equals actually says.
 */
export function standingPlaces(standings: CustomStanding[]): number[] {
  return standings.map((row) => {
    const first = standings.findIndex(
      (other) => other.wins === row.wins && other.winRate === row.winRate && other.games === row.games
    )
    return first + 1
  })
}

/** A member's inhouse record and where it puts them, or null before their first settled custom. */
export function inhouseRecordOf(standings: CustomStanding[], memberSlug: string) {
  const index = standings.findIndex((row) => row.memberSlug === memberSlug)
  if (index === -1) return null
  const row = standings[index]
  return {
    wins: row.wins,
    losses: row.losses,
    games: row.games,
    winRate: row.winRate,
    place: standingPlaces(standings)[index],
    of: standings.length,
  }
}
