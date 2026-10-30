import { describe, expect, it } from 'vitest'

import type { FeedMatch, FeedMember } from '@/lib/api'
import { dayStandings } from '@/lib/day'

const member = (slug: string, win: boolean, championId = 1, kda: [number, number, number] = [1, 1, 1]) =>
  ({
    memberSlug: slug,
    displayName: slug,
    championId,
    championName: `champ${championId}`,
    win,
    kills: kda[0],
    deaths: kda[1],
    assists: kda[2],
  }) as FeedMember

const match = (...members: FeedMember[]) => ({ matchId: Math.random().toString(), members }) as unknown as FeedMatch

describe('dayStandings', () => {
  it('counts each member’s games, record and rate', () => {
    const [noah] = dayStandings([
      match(member('noah', true, 1, [5, 2, 3])),
      match(member('noah', false, 1, [1, 4, 0])),
      match(member('noah', true, 2, [2, 0, 8])),
    ])
    expect(noah).toMatchObject({ games: 3, wins: 2, losses: 1, winRate: 66.7, kills: 8, deaths: 6, assists: 11 })
    expect(noah.champions.map((c) => [c.championId, c.games])).toEqual([[1, 2], [2, 1]])
  })

  it('splits a game where the group met itself', () => {
    const standings = dayStandings([match(member('a', true), member('b', false))])
    expect(standings.map((s) => [s.memberSlug, s.wins, s.losses])).toEqual([['a', 1, 0], ['b', 0, 1]])
  })

  it('ranks a long good evening above a single win', () => {
    const matches = [
      match(member('once', true)),
      ...[true, true, true, false].map((win) => match(member('grinder', win))),
    ]
    expect(dayStandings(matches).map((s) => s.memberSlug)).toEqual(['grinder', 'once'])
  })
})
