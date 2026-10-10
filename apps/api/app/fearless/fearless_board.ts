import type { CustomGameView, Side } from '#customs/custom_game_view'

/**
 * Which champions a fearless night has used up.
 *
 * Pure on purpose: nothing about a night is copied when a custom comes in, so a
 * custom sent late, deleted, or left out by the admin changes the answer on the
 * next read without anything to resynchronise. The night only stores its own
 * window and the admin's corrections.
 */

/** A night nobody ends closes by itself, so last week's customs never leak into this one. */
export const NIGHT_HOURS = 6

export type NightInput = {
  id: number
  label: string | null
  startedAt: Date
  endedAt: Date | null
  excludedCustomIds: number[]
}

export type AdjustmentInput = { championId: number; kind: 'burn' | 'free'; decidedAt: Date }

export type FearlessPick = {
  championId: number
  championName: string
  playerName: string
  memberSlug: string | null
  side: Side
}

export type FearlessGame = {
  id: number
  /** 1, 2, 3… among the games that count; null for an excluded one. */
  number: number | null
  label: string | null
  playedAt: string
  endedAt: string
  excluded: boolean
  picks: FearlessPick[]
}

export type FearlessBurn = {
  championId: number
  /** 'manual' only when no game that counts used it. */
  source: 'played' | 'manual'
  by: { playerName: string; memberSlug: string | null; gameNumber: number }[]
}

export type FearlessBoard = {
  night: { id: number; label: string | null; startedAt: string; endsAt: string; active: boolean }
  games: FearlessGame[]
  burned: FearlessBurn[]
  /** Champions freed by hand and not played since. */
  freed: number[]
}

export function nightEndsAt(night: Pick<NightInput, 'startedAt' | 'endedAt'>): Date {
  const cap = new Date(night.startedAt.getTime() + NIGHT_HOURS * 3_600_000)
  return night.endedAt && night.endedAt < cap ? night.endedAt : cap
}

/** `playedAt` is when the game started; a night is about when it ended. */
export function gameEndOf(game: Pick<CustomGameView, 'playedAt' | 'duration'>): Date {
  return new Date(new Date(game.playedAt).getTime() + game.duration * 1000)
}

export function fearlessBoard(
  night: NightInput,
  games: CustomGameView[],
  adjustments: AdjustmentInput[],
  now: Date
): FearlessBoard {
  const endsAt = nightEndsAt(night)
  const excluded = new Set(night.excludedCustomIds)

  const inNight = games
    .map((game) => ({ game, end: gameEndOf(game) }))
    .filter(({ end }) => end >= night.startedAt && end < endsAt)
    .sort((a, b) => a.end.getTime() - b.end.getTime())

  let counted = 0
  const rows = inNight.map(({ game, end }) => {
    const isExcluded = excluded.has(game.id)
    return {
      end,
      row: {
        id: game.id,
        number: isExcluded ? null : ++counted,
        label: game.label,
        playedAt: game.playedAt,
        endedAt: end.toISOString(),
        excluded: isExcluded,
        picks: game.teams.flatMap((team) =>
          team.players.map((player) => ({
            championId: player.championId,
            championName: player.championName,
            playerName: player.displayName ?? player.name,
            memberSlug: player.memberSlug,
            side: team.side,
          }))
        ),
      } satisfies FearlessGame,
    }
  })

  const adjustmentOf = new Map(adjustments.map((adjustment) => [adjustment.championId, adjustment]))

  // Every time a champion was played in a game that counts, oldest first.
  const plays = new Map<number, { end: Date; by: FearlessBurn['by'][number] }[]>()
  for (const { end, row } of rows) {
    if (row.number === null) continue
    for (const pick of row.picks) {
      // 0 is a champion the site could not name; burning "nothing" helps nobody.
      if (pick.championId <= 0) continue
      const list = plays.get(pick.championId) ?? []
      list.push({ end, by: { playerName: pick.playerName, memberSlug: pick.memberSlug, gameNumber: row.number } })
      plays.set(pick.championId, list)
    }
  }

  const champions = new Set([...plays.keys(), ...adjustmentOf.keys()])
  const burned: FearlessBurn[] = []
  const freed: number[] = []

  for (const championId of champions) {
    const adjustment = adjustmentOf.get(championId)
    // A free forgives the games that ended before it, not the ones after.
    const counting = (plays.get(championId) ?? []).filter(
      (play) => adjustment?.kind !== 'free' || play.end > adjustment.decidedAt
    )

    if (counting.length > 0) {
      burned.push({ championId, source: 'played', by: counting.map((play) => play.by) })
    } else if (adjustment?.kind === 'burn') {
      burned.push({ championId, source: 'manual', by: [] })
    } else if (adjustment?.kind === 'free') {
      freed.push(championId)
    }
  }

  return {
    night: {
      id: night.id,
      label: night.label,
      startedAt: night.startedAt.toISOString(),
      endsAt: endsAt.toISOString(),
      active: now < endsAt,
    },
    games: rows.map(({ row }) => row),
    burned: burned.sort((a, b) => a.championId - b.championId),
    freed: freed.sort((a, b) => a - b),
  }
}
