/**
 * Only the fields Pasen actually reads. The full payload is kept verbatim in
 * `matches.raw`, so widening a type later never means re-fetching from Riot.
 *
 * Note the absence of summonerId and accountId: Riot removed the endpoints
 * keyed on them on 2025-06-20, and the puuid is now the only identifier.
 */

export type AccountDto = {
  puuid: string
  gameName: string
  tagLine: string
}

export type SummonerDto = {
  puuid: string
  profileIconId: number
  summonerLevel: number
  revisionDate: number
}

/**
 * An apex league in full. `entries` carries every player in that tier, which is
 * the only way Riot exposes a ladder position: below Master there is no order,
 * just a tier and a division.
 */
export type LeagueListDto = {
  tier: string
  leagueId: string
  queue: string
  name: string
  entries: {
    puuid: string
    leaguePoints: number
    rank: string
    wins: number
    losses: number
  }[]
}

export type LeagueEntryDto = {
  leagueId: string
  queueType: string
  tier: string
  rank: string
  puuid: string
  leaguePoints: number
  wins: number
  losses: number
  hotStreak: boolean
  veteran: boolean
  freshBlood: boolean
  inactive: boolean
}

export type MatchParticipantDto = {
  puuid: string
  riotIdGameName?: string
  riotIdTagline?: string
  teamId: number
  championId: number
  championName: string
  teamPosition: string
  individualPosition: string
  win: boolean
  kills: number
  deaths: number
  assists: number
  goldEarned: number
  totalMinionsKilled: number
  neutralMinionsKilled: number
  totalDamageDealtToChampions: number
  totalDamageTaken: number
  visionScore: number
  wardsPlaced: number
  wardsKilled: number
  champLevel: number
  summoner1Id: number
  summoner2Id: number
  item0: number
  item1: number
  item2: number
  item3: number
  item4: number
  item5: number
  item6: number
  doubleKills: number
  tripleKills: number
  quadraKills: number
  pentaKills: number
  firstBloodKill: boolean
  gameEndedInEarlySurrender: boolean
  perks?: unknown
  /** Arena only: the 2-player team, and its 1-8 placement. */
  playerSubteamId?: number
  subteamPlacement?: number
}

export type MatchDto = {
  metadata: {
    matchId: string
    /** Every participant's puuid, in the same order as info.participants. */
    participants: string[]
  }
  info: {
    gameCreation: number
    gameDuration: number
    gameEndTimestamp?: number
    gameMode: string
    gameType: string
    gameVersion: string
    mapId: number
    platformId: string
    queueId: number
    participants: MatchParticipantDto[]
  }
}

export type CurrentGameParticipantDto = {
  /**
   * Empty for players Riot will not identify in spectator data. Those arrive
   * with the champion's name in `riotId`, which is not a Riot ID and must not
   * be shown as one.
   */
  puuid: string
  teamId: number
  championId: number
  spell1Id: number
  spell2Id: number
  riotId?: string
  perks?: unknown
}

export type CurrentGameInfoDto = {
  gameId: number
  gameType: string
  gameStartTime: number
  mapId: number
  /** Seconds elapsed. Negative or zero while the game is still loading. */
  gameLength: number
  platformId: string
  gameMode: string
  gameQueueConfigId: number
  participants: CurrentGameParticipantDto[]
  bannedChampions: { championId: number; teamId: number; pickTurn: number }[]
}
