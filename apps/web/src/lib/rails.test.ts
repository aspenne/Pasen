import { describe, expect, it } from 'vitest'

import type { Board, GroupOverview, MemberTotals } from '@/lib/api'
import { boardLeaders, rosterOrder } from '@/lib/rails'

type Member = GroupOverview['members'][number]
const member = (slug: string, tier: string | null, lp = 0, rank = 'I', totals: Partial<Member['totals']> = {}) =>
  ({
    slug,
    displayName: slug,
    accentColor: null,
    accounts: [],
    ranks: tier ? [{ queueType: 'RANKED_SOLO_5x5', tier, rank, leaguePoints: lp, wins: 0, losses: 0, decay: null }] : [],
    totals: { games: 0, wins: 0, winRate: 0, championsPlayed: 0, firstPlaces: 0, ...totals },
  }) as unknown as Member

describe('rosterOrder', () => {
  it('puts the highest solo rank first, the unranked last, and keeps each member’s index', () => {
    const members = [member('gold', 'GOLD', 50), member('none', null), member('master', 'MASTER', 300), member('diamond', 'DIAMOND', 10, 'II')]
    expect(rosterOrder(members, 'rift').map(({ member, index }) => [member.slug, index])).toEqual([
      ['master', 2],
      ['diamond', 3],
      ['gold', 0],
      ['none', 1],
    ])
  })

  it('ranks customs by wins', () => {
    const members = [member('a', null, 0, 'I', { wins: 2, winRate: 50 }), member('b', null, 0, 'I', { wins: 5, winRate: 40 })]
    expect(rosterOrder(members, 'custom').map(({ member }) => member.slug)).toEqual(['b', 'a'])
  })
})

describe('boardLeaders', () => {
  const totals = [
    { memberSlug: 'chaf', games: 3 },
    { memberSlug: 'noah', games: 30 },
    { memberSlug: 'zed', games: 12 },
  ] as MemberTotals[]
  const board = (key: string): Board => ({
    key,
    label: key,
    unit: '',
    entries: [
      { memberSlug: 'chaf', displayName: 'CHAF', value: 100 },
      { memberSlug: 'noah', displayName: 'Nøah', value: 90 },
      { memberSlug: 'zed', displayName: 'Zed', value: 60 },
    ],
  })

  it('leaves out anyone under the minimum games on a rate board', () => {
    expect(boardLeaders(board('winRate'), totals, 5).map((e) => e.displayName)).toEqual(['Nøah', 'Zed'])
  })

  it('keeps everyone on a count board, three at most', () => {
    expect(boardLeaders(board('games'), totals, 5)).toHaveLength(3)
  })
})
