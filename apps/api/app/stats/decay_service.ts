import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import { decayRuleFor, simulateBank, type DecayDay } from '@pasen/shared'

/**
 * How long each Diamond-and-above standing has before it starts losing LP.
 *
 * Riot does not publish the counter, so it is reconstructed from the games we
 * already hold. The rules themselves live in the shared package, tested there;
 * this file only gathers the history to feed them.
 */
export type DecayStatus = {
  daysLeft: number
  cap: number
  lpPerDay: number
  /** False while the window is too short for the answer to be more than a guess. */
  confident: boolean
  /** Riot's own flag, when we have it. Beats our arithmetic wherever they disagree. */
  inactive: boolean
}

/** Which ranked queue a stored match belongs to, for the queues that decay. */
const QUEUE_IDS: Record<string, number> = {
  RANKED_SOLO_5x5: 420,
  RANKED_FLEX_SR: 440,
}

/**
 * A year. The starting bank is assumed full, so the window has to be long
 * enough for that assumption to be erased by real history - and long enough
 * that someone who stopped playing in spring still reads as long gone.
 */
const WINDOW_DAYS = 365

export type DecayKey = `${number}:${string}`

/** Keyed by account id and queue, because decay is per account and per queue. */
export function decayKey(accountId: number, queueType: string): DecayKey {
  return `${accountId}:${queueType}`
}

export class DecayService {
  /**
   * One query for every account at once rather than one per player: the daily
   * counts for twenty-six members over a year are a few thousand rows, where
   * the per-player version would be twenty-six round trips to answer one page.
   */
  async forAccounts(
    standings: { accountId: number; puuid: string; queueType: string; tier: string | null }[],
    timezone: string,
    now = DateTime.utc()
  ): Promise<Map<DecayKey, DecayStatus>> {
    const decaying = standings.filter(
      (standing) => decayRuleFor(standing.tier) !== null && standing.queueType in QUEUE_IDS
    )
    if (decaying.length === 0) return new Map()

    const puuids = [...new Set(decaying.map((standing) => standing.puuid))]
    const queueIds = [...new Set(decaying.map((standing) => QUEUE_IDS[standing.queueType]))]
    const since = now.minus({ days: WINDOW_DAYS }).toSQL({ includeOffset: false })

    /*
     * Days are counted in the group's own timezone. A game at one in the
     * morning belongs to the night before as far as anyone reading the site is
     * concerned, and a day boundary that moves with UTC would make the number
     * flicker for European players every evening.
     */
    const rows = await db.rawQuery(
      `SELECT p.puuid, m.queue_id,
              to_char(m.game_creation AT TIME ZONE ?, 'YYYY-MM-DD') AS day,
              count(*)::int AS games
       FROM match_participants p
       JOIN matches m ON m.match_id = p.match_id
       WHERE p.puuid = ANY(?)
         AND m.queue_id = ANY(?)
         AND m.game_creation >= ?
       GROUP BY p.puuid, m.queue_id, day
       ORDER BY day`,
      [timezone, puuids, queueIds, since]
    )

    const history = new Map<string, DecayDay[]>()
    for (const row of rows.rows) {
      const key = `${row.puuid}:${row.queue_id}`
      const list = history.get(key) ?? []
      list.push({ day: row.day, games: row.games })
      history.set(key, list)
    }

    const today = now.setZone(timezone).toFormat('yyyy-MM-dd')
    const out = new Map<DecayKey, DecayStatus>()

    for (const standing of decaying) {
      const rule = decayRuleFor(standing.tier)!
      const days = history.get(`${standing.puuid}:${QUEUE_IDS[standing.queueType]}`) ?? []
      const state = simulateBank(days, rule, today)
      out.set(decayKey(standing.accountId, standing.queueType), { ...state, inactive: false })
    }

    return out
  }

  /**
   * Overlays Riot's own flag onto the estimate. Where they disagree, Riot wins
   * and the countdown is forced to zero: an estimate that says "nine days left"
   * about an account Riot has already flagged is worse than no estimate.
   */
  static reconcile(status: DecayStatus, inactive: boolean): DecayStatus {
    if (!inactive) return status
    return { ...status, daysLeft: 0, inactive: true, confident: true }
  }
}
