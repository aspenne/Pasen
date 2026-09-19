import type { Platform } from '@pasen/shared'
import { DateTime } from 'luxon'

import RiotAccount from '#models/riot_account'
import type { RiotClient } from '#riot/client'
import type { RedisLike } from '#riot/redis'
import type { CurrentGameInfoDto } from '#riot/types'

const CACHE_KEY = 'live:games'
/** Comfortably longer than the poll interval, short enough to self-heal. */
const CACHE_TTL_SECONDS = 180

/**
 * Ranked standing moves by a few LP a day and a game lasts half an hour, so a
 * long cache turns "ten lookups per poll" into "ten lookups per new game" - the
 * difference between half our rate budget and a rounding error.
 */
const RANK_CACHE_TTL_SECONDS = 12 * 60 * 60

export type LiveRank = {
  tier: string
  rank: string | null
  leaguePoints: number
  wins: number
  losses: number
}

export type LiveGame = {
  gameId: number
  platform: Platform
  queueId: number
  gameMode: string
  startedAt: string
  /** Seconds elapsed. Riot reports 0 or less while the game is still loading. */
  lengthSeconds: number
  participants: {
    /** Null for a player Riot declines to identify. */
    puuid: string | null
    teamId: number
    championId: number
    spell1Id: number
    spell2Id: number
    riotId: string | null
    /** True for the members of this group, which is who the card is about. */
    tracked: boolean
    /** Solo queue standing. Null for an unranked player or a failed lookup. */
    rank: LiveRank | null
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
    for (const game of payload) await this.#attachRanks(game)

    await this.redis.set(CACHE_KEY, JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS)

    return { polled: accounts.length, inGame: payload.length, justFinished }
  }

  /**
   * Fills in every player's solo queue standing, cached per player.
   *
   * Background priority throughout: knowing an opponent is Diamond is worth far
   * less than the spectator poll that found the game in the first place, and
   * the reserve makes sure a lobby of ten strangers cannot crowd it out.
   */
  async #attachRanks(game: LiveGame): Promise<void> {
    for (const participant of game.participants) {
      // No puuid, no lookup - asking anyway just burns budget on a 400.
      if (!participant.puuid) continue

      const key = `live:rank:${game.platform}:${participant.puuid}`
      const cached = await this.redis.get(key)

      if (cached !== null) {
        participant.rank = JSON.parse(cached) as LiveRank | null
        continue
      }

      let rank: LiveRank | null = null
      try {
        const entries = await this.riot.league.entriesByPuuid(
          participant.puuid,
          game.platform,
          { priority: 'background' }
        )
        const solo = entries.find((entry) => entry.queueType === 'RANKED_SOLO_5x5')
        if (solo) {
          rank = {
            tier: solo.tier,
            rank: solo.rank ?? null,
            leaguePoints: solo.leaguePoints,
            wins: solo.wins,
            losses: solo.losses,
          }
        }
      } catch {
        /*
         * One unreachable standing must not cost us the whole live view, and a
         * failure is deliberately not cached - the next poll tries again.
         */
        continue
      }

      participant.rank = rank
      await this.redis.set(key, JSON.stringify(rank), 'EX', RANK_CACHE_TTL_SECONDS)
    }
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
    platform: game.platformId as Platform,
    queueId: game.gameQueueConfigId,
    gameMode: game.gameMode,
    startedAt: DateTime.fromMillis(game.gameStartTime, { zone: 'utc' }).toISO()!,
    lengthSeconds: Math.max(game.gameLength, 0),
    participants: game.participants.map((p) => {
      const puuid = p.puuid || null
      return {
        puuid,
        teamId: p.teamId,
        championId: p.championId,
        spell1Id: p.spell1Id,
        spell2Id: p.spell2Id,
        // Without a puuid the "riotId" Riot sends is the champion's name.
        riotId: puuid ? (p.riotId ?? null) : null,
        tracked: puuid !== null && tracked.has(puuid),
        rank: null,
      }
    }),
  }
}
