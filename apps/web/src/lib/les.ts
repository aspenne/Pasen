import type { LesBoard } from '@/lib/api'

const DAY = 86_400_000

/**
 * How far off the LAN is. The board freezes when the LAN day starts; that day
 * says so, and after it the page shows the final standings.
 */
export function countdownLabel(endsAt: string, now: number = Date.now()): string {
  const left = Date.parse(endsAt) - now
  if (left > 0) {
    const days = Math.ceil(left / DAY)
    return `${days} day${days === 1 ? '' : 's'} to go`
  }
  return left > -DAY ? 'LAN day' : 'Final standings'
}

/** Where an account added after the start begins counting. */
export function sinceLabel(since: string): string {
  return `since added on ${new Date(since).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })}`
}

type Entry = LesBoard['entries'][number]

/** Who the standings show: both LAN teams (the default), one of them, or the whole group. */
export type LesFilter = 'teams' | 'honest' | 'hungry' | 'everyone'

export function entriesFor(entries: Entry[], filter: LesFilter): Entry[] {
  if (filter === 'everyone') return entries
  if (filter === 'teams') return entries.filter((entry) => entry.team !== null)
  return entries.filter((entry) => entry.team === filter)
}

/** What the shown accounts did together, for the numbers above the standings. */
export function summarise(entries: Entry[]) {
  return {
    lpGained: entries.reduce((total, e) => total + e.lpGained, 0),
    games: entries.reduce((total, e) => total + e.games, 0),
    activeAccounts: entries.filter((e) => e.games > 0).length,
    accounts: entries.length,
  }
}
