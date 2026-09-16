import { DateTime } from 'luxon'

import RiotAccount from '#models/riot_account'
import type { RiotClient } from '#riot/client'
import type { RedisLike } from '#riot/redis'
import type { CurrentGameInfoDto } from '#riot/types'

const CACHE_KEY = 'live:games'
/** Comfortably longer than the poll interval, short enough to self-heal. */
const CACHE_TTL_SECONDS = 180

export type LiveGame = {
  gameId: number
  platform: string
  queueId: number
  gameMode: string
  startedAt: string
  /** Seconds elapsed. Riot reports 0 or less while the game is still loading. */
  lengthSeconds: number
  participants: {
    puuid: string
    teamId: number
    championId: number
    spell1Id: number
    spell2Id: number
    riotId: string | null
    /** True for the members of this group, which is who the card is about. */
    tracked: boolean
  }[]
}

export type LivePollResult = {
  polled: number
  inGame: number
  /** Accounts whose game ended since the last poll; their matches are now fetchable. */
  justFinished: RiotAccount[]
}

/**
 * Keeps the "who is playing right now" view fresh.
 *
 * Polling is the worker's job and reading is the API's: the result lands in
 * Redis so a page request never waits on Riot, and so a burst of visitors costs
 * no extra API budget.
 */
export class LiveGameService {
  constructor(
    private riot: RiotClient,
    private redis: RedisLike
  ) {}

  async poll(accounts: RiotAccount[]): Promise<LivePollResult> {
    const tracked = new Set(accounts.map((a) => a.puuid))
    const games = new Map<number, LiveGame>()
    const justFinished: RiotAccount[] = []
    const now = DateTime.utc()

    for (const account of accounts) {
      const current = await this.riot.spectator.activeGameByPuuid(account.puuid, account.platform)

      if (!current) {
        /*
         * A game that was there a moment ago and is gone now has just ended, and
         * its match is fetchable within seconds. Reporting it lets the caller
         * sync immediately instead of waiting for the next scheduled pass, which
         * is what makes a finished game reach the feed almost at once.
         */
        if (account.lastSeenLiveAt) {
          justFinished.push(account)
          account.lastSeenLiveAt = null
          await account.save()
        }
        continue
      }

      account.lastSeenLiveAt = now
      await account.save()

      // Several members in the same game produce one card, not one per member.
      games.set(current.gameId, toLiveGame(current, tracked))
    }

    const payload = [...games.values()]
    await this.redis.set(CACHE_KEY, JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS)

    return { polled: accounts.length, inGame: payload.length, justFinished }
  }

  /** What the API serves. Never calls Riot. */
  async current(): Promise<LiveGame[]> {
    const cached = await this.redis.get(CACHE_KEY)
    return cached ? (JSON.parse(cached) as LiveGame[]) : []
  }
}

function toLiveGame(game: CurrentGameInfoDto, tracked: Set<string>): LiveGame {
  return {
    gameId: game.gameId,
    platform: game.platformId,
    queueId: game.gameQueueConfigId,
    gameMode: game.gameMode,
    startedAt: DateTime.fromMillis(game.gameStartTime, { zone: 'utc' }).toISO()!,
    lengthSeconds: Math.max(game.gameLength, 0),
    participants: game.participants.map((p) => ({
      puuid: p.puuid,
      teamId: p.teamId,
      championId: p.championId,
      spell1Id: p.spell1Id,
      spell2Id: p.spell2Id,
      riotId: p.riotId ?? null,
      tracked: tracked.has(p.puuid),
    })),
  }
}
