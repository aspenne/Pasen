import type { CustomGame } from '@/lib/api'

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
