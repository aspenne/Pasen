import { DRAFT_ROLES, type DraftAction, type DraftRole, type DraftSide } from '@pasen/shared'

/** The length of a turn on the clock. Shown only: nothing happens at zero. */
export const TURN_SECONDS = 30

/** Seconds left in the turn, on the server's clock, never below zero. */
export function secondsLeft(stepStartedAt: string, serverOffsetMs: number, now: number = Date.now()): number {
  const elapsed = now + serverOffsetMs - Date.parse(stepStartedAt)
  return Math.max(0, Math.min(TURN_SECONDS, Math.ceil(TURN_SECONDS - elapsed / 1000)))
}

/** A side's picks, lane by lane, so each sits in front of the player of that lane. */
export function picksByRole(actions: readonly DraftAction[], side: DraftSide): Record<DraftRole, number | null> {
  const lanes = Object.fromEntries(DRAFT_ROLES.map((role) => [role, null])) as Record<DraftRole, number | null>
  for (const action of actions) {
    if (action.side === side && action.kind === 'pick' && action.role) lanes[action.role] = action.championId
  }
  return lanes
}

/** A side's five bans, in the order they were made, empty slots last. */
export function bansOf(actions: readonly DraftAction[], side: DraftSide): (number | null)[] {
  const bans = actions.filter((a) => a.side === side && a.kind === 'ban').map((a) => a.championId)
  return [...bans, ...Array(5 - bans.length).fill(null)]
}

export function turnLabel(current: { step?: number; side: DraftSide; kind: 'ban' | 'pick' } | null): string {
  if (!current) return 'Draft complete'
  return `${current.side === 'blue' ? 'Blue' : 'Red'} ${current.kind === 'ban' ? 'banning' : 'picking'}`
}

const SEAT_KEY = (draftId: number) => `pasen-draft-seat-${draftId}`

/** The seat this browser holds in a draft, if any. Kept in the browser only: it is the captain's key. */
export function readSeat(draftId: number): { side: DraftSide; token: string } | null {
  try {
    const raw = localStorage.getItem(SEAT_KEY(draftId))
    return raw ? (JSON.parse(raw) as { side: DraftSide; token: string }) : null
  } catch {
    return null
  }
}

export function writeSeat(draftId: number, seat: { side: DraftSide; token: string } | null) {
  try {
    if (seat) localStorage.setItem(SEAT_KEY(draftId), JSON.stringify(seat))
    else localStorage.removeItem(SEAT_KEY(draftId))
  } catch {
    // Private mode: the seat lasts as long as the page does.
  }
}
