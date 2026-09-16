import type { Platform } from '@pasen/shared'

import type { RiotRequester } from '#riot/gateway'
import type { MatchDto } from '#riot/types'

/** Riot's hard cap on one page of match ids. */
export const MATCH_IDS_PAGE_SIZE = 100

export type MatchIdQuery = {
  /** Offset into the player's history, newest first. */
  start?: number
  count?: number
  /** Epoch seconds, not milliseconds - Riot rejects millisecond values here. */
  startTime?: number
  endTime?: number
  queue?: number
  type?: 'ranked' | 'normal' | 'tourney' | 'tutorial'
}

export type FetchPriority = { priority?: 'interactive' | 'background' }

export class MatchEndpoint {
  constructor(private gateway: RiotRequester) {}

  /**
   * Ids only, newest first, 100 per call at most. Fetching the detail of each is
   * a separate request, which is what makes a full backfill expensive: one call
   * per match, against a budget of 100 requests per two minutes.
   */
  idsByPuuid(
    puuid: string,
    platform: Platform,
    query: MatchIdQuery = {},
    options: FetchPriority = {}
  ) {
    return this.gateway.request<string[]>({
      host: { kind: 'match', platform },
      path: `/lol/match/v5/matches/by-puuid/${puuid}/ids`,
      endpoint: 'match-v5.idsByPuuid',
      priority: options.priority,
      search: {
        start: query.start ?? 0,
        count: Math.min(query.count ?? MATCH_IDS_PAGE_SIZE, MATCH_IDS_PAGE_SIZE),
        startTime: query.startTime,
        endTime: query.endTime,
        queue: query.queue,
        type: query.type,
      },
    })
  }

  byId(matchId: string, platform: Platform, options: FetchPriority = {}) {
    return this.gateway.request<MatchDto>({
      host: { kind: 'match', platform },
      path: `/lol/match/v5/matches/${matchId}`,
      endpoint: 'match-v5.byId',
      priority: options.priority,
    })
  }

  /**
   * Minute-by-minute events. Doubles the cost of ingesting a match and returns a
   * payload several times larger, so it stays behind RIOT_FETCH_TIMELINES.
   */
  timelineById(matchId: string, platform: Platform) {
    return this.gateway.request<unknown>({
      host: { kind: 'match', platform },
      path: `/lol/match/v5/matches/${matchId}/timeline`,
      endpoint: 'match-v5.timelineById',
    })
  }
}
