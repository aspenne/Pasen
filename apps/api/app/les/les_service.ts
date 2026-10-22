import { DateTime } from 'luxon'

import Group from '#models/group'
import LeagueEntry from '#models/league_entry'
import RiotAccount from '#models/riot_account'
import { LES_EVENT, lesBoard, type LesBoard } from '#les/les_board'

/** Ranks are read hourly; recomputing more often than this would only repeat the same answer. */
const CACHE_MS = 5 * 60_000

/** Readings older than this before the start cannot be anyone's starting point anymore. */
const LOOK_BACK = { days: 120 }

const cache = new Map<number, { at: number; board: LesBoard }>()

export class LesService {
  async board(group: Group, now: Date = new Date()): Promise<LesBoard> {
    const cached = cache.get(group.id)
    if (cached && now.getTime() - cached.at < CACHE_MS) return cached.board

    const accounts = await RiotAccount.query()
      .whereHas('member', (member) => member.whereHas('groups', (groups) => groups.where('groups.id', group.id)))
      .preload('member')
      .orderBy('id', 'asc')

    const ids = accounts.map((account) => account.id)
    const cutoff = new Date(Math.min(now.getTime(), LES_EVENT.endsAt.getTime()))
    const readings = ids.length
      ? await LeagueEntry.query()
          .whereIn('riot_account_id', ids)
          .where('queue_type', 'RANKED_SOLO_5x5')
          .where('captured_at', '>=', DateTime.fromJSDate(LES_EVENT.startsAt).minus(LOOK_BACK).toUTC().toISO()!)
          .where('captured_at', '<=', cutoff.toISOString())
      : []

    const board = lesBoard(
      accounts.map((account) => ({
        id: account.id,
        memberSlug: account.member.slug,
        // One line per account, so each under its own in-game name.
        displayName: account.gameName,
        riotId: `${account.gameName}#${account.tagLine}`,
        profileIconId: account.profileIconId,
      })),
      readings.map((r) => ({
        accountId: r.riotAccountId,
        capturedAt: r.capturedAt.toJSDate(),
        tier: r.tier,
        rank: r.rank,
        leaguePoints: r.leaguePoints,
        wins: r.wins,
        losses: r.losses,
      })),
      now
    )

    cache.set(group.id, { at: now.getTime(), board })
    return board
  }
}
