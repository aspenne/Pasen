import { ladderPoints } from '@pasen/shared'
import { DateTime } from 'luxon'

/**
 * Road to LES: LP won in Solo/Duo between the 1st of October and the Lyon
 * e-Sport LAN, account by account.
 *
 * Built from the hourly rank readings alone. LP come from the ladder scale, so
 * a promotion counts its real LP; games come from the win and loss counters
 * Riot keeps, not from the games Pasen happened to fetch.
 */
export const LES_EVENT = {
  name: 'Lyon e-Sport',
  startsAt: DateTime.fromObject({ year: 2026, month: 10, day: 1 }, { zone: 'Europe/Paris' }).toJSDate(),
  endsAt: DateTime.fromObject({ year: 2026, month: 11, day: 13 }, { zone: 'Europe/Paris' }).toJSDate(),
} as const

export type LesAccount = {
  id: number
  memberSlug: string
  displayName: string
  riotId: string
  profileIconId: number | null
}

/** One Solo/Duo reading of an account's rank. */
export type LesReading = {
  accountId: number
  capturedAt: Date
  tier: string | null
  rank: string | null
  leaguePoints: number
  wins: number
  losses: number
}

type Rank = { tier: string | null; rank: string | null; leaguePoints: number }

export type LesEntry = {
  memberSlug: string
  displayName: string
  riotId: string
  profileIconId: number | null
  start: Rank | null
  current: Rank | null
  lpGained: number
  games: number
  wins: number
  losses: number
  /** Set when the account has no reading before the event: where its count starts. */
  since: string | null
}

export type LesBoard = {
  event: { name: string; startsAt: string; endsAt: string; finished: boolean }
  totals: { lpGained: number; games: number; activeAccounts: number; accounts: number }
  entries: LesEntry[]
}

const rankOf = (r: LesReading): Rank => ({ tier: r.tier, rank: r.rank, leaguePoints: r.leaguePoints })

export function lesBoard(accounts: LesAccount[], readings: LesReading[], now: Date): LesBoard {
  const start = LES_EVENT.startsAt.getTime()
  const end = LES_EVENT.endsAt.getTime()
  // Once the LAN starts, the board is the final standings: nothing after it counts.
  const cutoff = Math.min(now.getTime(), end)

  const byAccount = new Map<number, LesReading[]>()
  for (const r of readings) {
    const list = byAccount.get(r.accountId) ?? []
    list.push(r)
    byAccount.set(r.accountId, list)
  }

  const entries = accounts.map((account): LesEntry => {
    const own = (byAccount.get(account.id) ?? [])
      .filter((r) => r.capturedAt.getTime() <= cutoff)
      .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime())

    const before = own.filter((r) => r.capturedAt.getTime() <= start).at(-1)
    // Added after the start: its count begins at its first reading, and the page says so.
    const first = before ?? own.find((r) => r.capturedAt.getTime() > start)
    const last = own.at(-1)

    const base = {
      memberSlug: account.memberSlug,
      displayName: account.displayName,
      riotId: account.riotId,
      profileIconId: account.profileIconId,
    }
    if (!first || !last) {
      return { ...base, start: null, current: null, lpGained: 0, games: 0, wins: 0, losses: 0, since: null }
    }

    const from = ladderPoints(rankOf(first))
    const to = ladderPoints(rankOf(last))
    const wins = Math.max(0, last.wins - first.wins)
    const losses = Math.max(0, last.losses - first.losses)
    return {
      ...base,
      start: rankOf(first),
      current: rankOf(last),
      lpGained: from !== null && to !== null ? to - from : 0,
      games: wins + losses,
      wins,
      losses,
      since: before ? null : first.capturedAt.toISOString(),
    }
  })

  entries.sort(
    (a, b) =>
      b.lpGained - a.lpGained ||
      b.games - a.games ||
      a.displayName.localeCompare(b.displayName, 'en') ||
      a.riotId.localeCompare(b.riotId, 'en')
  )

  return {
    event: {
      name: LES_EVENT.name,
      startsAt: LES_EVENT.startsAt.toISOString(),
      endsAt: LES_EVENT.endsAt.toISOString(),
      finished: now.getTime() >= end,
    },
    totals: {
      lpGained: entries.reduce((sum, e) => sum + e.lpGained, 0),
      games: entries.reduce((sum, e) => sum + e.games, 0),
      activeAccounts: entries.filter((e) => e.games > 0).length,
      accounts: entries.length,
    },
    entries,
  }
}
