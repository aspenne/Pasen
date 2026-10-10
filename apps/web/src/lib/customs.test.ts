import { describe, expect, it } from 'vitest'

import type { CustomStanding } from '@/lib/api'
import { inhouseRecordOf, standingPlaces } from '@/lib/customs'

function row(key: string, wins: number, games: number, memberSlug: string | null = key): CustomStanding {
  return {
    key,
    memberSlug,
    name: key,
    wins,
    losses: games - wins,
    games,
    winRate: Math.round((wins / games) * 1000) / 10,
  }
}

// Sorted the way the API sends them: most wins first.
const standings = [row('a', 5, 9), row('b', 3, 4), row('c', 3, 4), row('d', 1, 5), row('friend', 1, 2, null)]

describe('standingPlaces', () => {
  it('shares a place between equal records', () => {
    expect(standingPlaces(standings)).toEqual([1, 2, 2, 4, 5])
  })
})

describe('inhouseRecordOf', () => {
  it("gives a member's record and their place among everyone", () => {
    expect(inhouseRecordOf(standings, 'c')).toEqual({
      wins: 3,
      losses: 1,
      games: 4,
      winRate: 75,
      place: 2,
      of: 5,
    })
  })

  it('is null for a member who never played a settled custom', () => {
    expect(inhouseRecordOf(standings, 'nobody')).toBeNull()
  })
})
