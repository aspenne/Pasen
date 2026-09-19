import type { Platform } from '@pasen/shared'

import type { RiotClient } from '#riot/client'
import type { RedisLike } from '#riot/redis'

/**
 * Riot orders only the three apex tiers. Below Master a player has a tier and a
 * division and nothing else - there is no hundred-thousandth place to report,
 * and no endpoint that would give one.
 */
const APEX = ['challenger', 'grandmaster', 'master'] as const

/** Three large responses, so they are fetched once an hour and shared. */
const CACHE_TTL_SECONDS = 60 * 60

export type LadderPosition = {
  /** 1-based place on the apex ladder. */
  position: number
  /** How many players are in Master and above, which is what `position` is out of. */
  apexPopulation: number
  platform: Platform
}

export class LadderService {
  constructor(
    private riot: RiotClient,
    private redis: RedisLike
  ) {}

  /** Null for anyone below Master, where no ladder position exists. */
  async positionFor(
    puuid: string,
    platform: Platform,
    queue = 'RANKED_SOLO_5x5'
  ): Promise<LadderPosition | null> {
    const ladder = await this.#ladder(platform, queue)
    const position = ladder.positions[puuid]
    if (position === undefined) return null

    return { position, apexPopulation: ladder.total, platform }
  }

  async #ladder(
    platform: Platform,
    queue: string
  ): Promise<{ positions: Record<string, number>; total: number }> {
    const key = `ladder:${platform}:${queue}`
    const cached = await this.redis.get(key)
    if (cached) return JSON.parse(cached)

    const entries: { puuid: string; leaguePoints: number }[] = []
    for (const apex of APEX) {
      const league = await this.riot.league.apexLeague(apex, queue, platform, {
        priority: 'background',
      })
      entries.push(...league.entries)
    }

    /*
     * Challenger, Grandmaster and Master are one continuous ladder ordered by
     * LP, so sorting the three together is what produces a real position -
     * Riot's own client shows the same number.
     */
    entries.sort((a, b) => b.leaguePoints - a.leaguePoints)

    const positions: Record<string, number> = {}
    entries.forEach((entry, index) => {
      positions[entry.puuid] = index + 1
    })

    const ladder = { positions, total: entries.length }
    await this.redis.set(key, JSON.stringify(ladder), 'EX', CACHE_TTL_SECONDS)
    return ladder
  }
}
