import type { QueueScope } from '@pasen/shared'

import type { Board, GroupOverview, MemberTotals } from '@/lib/api'
import { rankScore, rankedQueueFor } from '@/lib/format'

type Member = GroupOverview['members'][number]

/**
 * The roster in standing order, for the filter in use: ladder rank for the
 * ranked queues, first places in Arena (no ladder, podiums count as wins), and
 * most wins in customs. Each member keeps their original index, which their
 * colour follows - reordering the list must not repaint the group.
 */
export function rosterOrder(members: Member[], scope: QueueScope): { member: Member; index: number }[] {
  const queueType = rankedQueueFor(scope)
  const standing = (member: Member) =>
    scope === 'arena'
      ? member.totals.firstPlaces
      : scope === 'custom'
        ? member.totals.wins + member.totals.winRate / 1000
        : rankScore(member.ranks.find((rank) => rank.queueType === queueType))

  return members
    .map((member, index) => ({ member, index }))
    .sort((a, b) => standing(b.member) - standing(a.member) || a.index - b.index)
}

/** Boards that are a rate: a 100 % on three games is not a week's best. */
const RATE_BOARDS = new Set(['winRate', 'kda', 'csPerMinute', 'visionPerGame', 'deathsPerGame'])

/** A board's top three, leaving out anyone under the minimum games on a rate board. */
export function boardLeaders(board: Board, totals: MemberTotals[], minimumGames: number) {
  const games = new Map(totals.map((total) => [total.memberSlug, total.games]))
  return board.entries
    .filter((entry) => !RATE_BOARDS.has(board.key) || (games.get(entry.memberSlug) ?? 0) >= minimumGames)
    .slice(0, 3)
}
