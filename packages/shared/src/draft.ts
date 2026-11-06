/**
 * The rules of a draft, shared by the API that enforces them and the page that
 * shows them, so the two can never disagree about whose turn it is.
 *
 * Tournament order: three bans each, six picks, two bans each, four picks.
 */
export type DraftSide = 'blue' | 'red'
export type DraftKind = 'ban' | 'pick'

export const DRAFT_ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const
export type DraftRole = (typeof DRAFT_ROLES)[number]

const step = (side: DraftSide, kind: DraftKind) => ({ side, kind })
const B = 'blue' as const
const R = 'red' as const

export const DRAFT_STEPS: readonly { side: DraftSide; kind: DraftKind }[] = [
  ...[B, R, B, R, B, R].map((s) => step(s, 'ban')),
  ...[B, R, R, B, B, R].map((s) => step(s, 'pick')),
  ...[R, B, R, B].map((s) => step(s, 'ban')),
  ...[R, B, B, R].map((s) => step(s, 'pick')),
]

export type DraftAction = {
  step: number
  side: DraftSide
  kind: DraftKind
  championId: number
  /**
   * The seat a pick fills, named by the lane of the player sitting there:
   * picks fill a side's seats in order, whatever the champion plays. Null
   * for a ban.
   */
  role: DraftRole | null
}

/** The step to play next, or null once the draft is complete. */
export function currentStep(actions: readonly DraftAction[]): number | null {
  return actions.length < DRAFT_STEPS.length ? actions.length : null
}

/**
 * The seat a side's next pick fills: the first one still empty, top to
 * bottom. The first pick goes to the first player, whoever the champion is
 * for - the players sort out who plays it, as in a real champion select.
 * Null when the side is full.
 */
export function nextSeat(taken: readonly string[]): DraftRole | null {
  return DRAFT_ROLES.find((role) => !taken.includes(role)) ?? null
}

export type DraftRefusal = 'finished' | 'not-your-turn' | 'taken' | 'burned'

/**
 * Whether `side` may lock `championId` now: it is their turn, the champion is
 * not banned or picked yet in this draft, and not burned in the fearless
 * night. A pick also gets its seat, the side's next empty one.
 */
export function validateAction(input: {
  actions: readonly DraftAction[]
  burned: ReadonlySet<number>
  side: DraftSide
  championId: number
}):
  | { ok: true; step: number; kind: DraftKind; role: DraftRole | null }
  | { ok: false; reason: DraftRefusal } {
  const index = currentStep(input.actions)
  if (index === null) return { ok: false, reason: 'finished' }
  const next = DRAFT_STEPS[index]
  if (next.side !== input.side) return { ok: false, reason: 'not-your-turn' }
  if (input.actions.some((action) => action.championId === input.championId)) return { ok: false, reason: 'taken' }
  if (input.burned.has(input.championId)) return { ok: false, reason: 'burned' }

  if (next.kind === 'ban') return { ok: true, step: index, kind: 'ban', role: null }

  const taken = input.actions
    .filter((action) => action.side === input.side && action.kind === 'pick' && action.role)
    .map((action) => action.role as string)
  return { ok: true, step: index, kind: 'pick', role: nextSeat(taken) }
}
