import type { QueueGroup, QueueScope } from '@pasen/shared'

/*
 * Empty in production: the site and the API share one origin behind the reverse
 * proxy, so requests go out relative. That removes CORS entirely and keeps the
 * admin session cookie first-party. In development the two run on separate
 * ports, hence the fallback.
 */
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * Every call carries credentials because the admin session is cookie-based, and
 * surfaces a non-2xx as a thrown ApiError so TanStack Query treats it as a
 * failure instead of caching an error body as data.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new ApiError(response.status, body || response.statusText)
  }

  // 204 and friends carry no body; calling .json() on them throws.
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export type HealthResponse = {
  status: 'ok' | 'degraded'
  checks: { database: { ok: boolean }; redis: { ok: boolean } }
}

/**
 * Riot publishes no decay countdown, so this is derived from the games we hold.
 * Null for every tier that does not decay - Emerald and below.
 */
export type DecayStatus = {
  daysLeft: number
  cap: number
  lpPerDay: number
  /** False while the history is too short for the number to mean much. */
  confident: boolean
  /** Riot's own flag. When it is set, the standing is already losing LP. */
  inactive: boolean
}

export type MemberRank = {
  queueType: string
  tier: string | null
  rank: string | null
  leaguePoints: number
  wins: number
  losses: number
  decay: DecayStatus | null
}

/**
 * A captured custom game, as the page draws it. Built from the agent's Live
 * Client capture, which has no match id, no champion ids and no winning team -
 * all three are reconstructed server-side.
 */
export type CustomSide = 'ORDER' | 'CHAOS'

export type CustomPlayer = {
  riotId: string
  name: string
  isBot: boolean
  memberSlug: string | null
  displayName: string | null
  championId: number
  championName: string
  position: string | null
  level: number
  kills: number
  deaths: number
  assists: number
  cs: number
  wardScore: number
  items: number[]
  perks: unknown
  summonerSpells: [number, number]
  bestMultikill: number
}

export type CustomTeam = {
  side: CustomSide
  /** Null when the capture ended without a GameEnd event. */
  won: boolean | null
  kills: number
  objectives: {
    turrets: number
    inhibitors: number
    dragons: number
    grubs: number
    heralds: number
    barons: number
  }
  players: CustomPlayer[]
}

export type CustomGame = {
  id: number
  label: string | null
  playedAt: string
  duration: number
  gameMode: string
  mapName: string | null
  capturedBy: string | null
  resultKnown: boolean
  /** Where the result came from: the capture, a decision by hand, or nowhere. */
  resultSource: 'capture' | 'manual' | null
  againstBots: boolean
  firstBlood: string | null
  teams: CustomTeam[]
}

/** One line of the customs leaderboard: a member, or a friend keyed by Riot ID. */
export type CustomStanding = {
  key: string
  memberSlug: string | null
  name: string
  wins: number
  losses: number
  games: number
  winRate: number
}

export type CustomStandings = {
  standings: CustomStanding[]
  counted: number
  skipped: { againstBots: number; unknownResult: number }
}

/** A member, or a friend keyed by Riot ID - the same identity every customs table uses. */
export type CustomIdentity = { key: string; memberSlug: string | null; name: string }

export type CustomPlayerLine = CustomIdentity & {
  games: number
  kills: number
  deaths: number
  assists: number
  kda: number
  killsPerGame: number
  deathsPerGame: number
  assistsPerGame: number
  csPerMinute: number
  visionPerGame: number
  firstBloods: number
  bestMultikill: number
}

export type CustomRecordLine = CustomIdentity & {
  kind: 'kills' | 'assists' | 'deaths' | 'cs'
  value: number
  championId: number
  championName: string
  gameId: number
  gameLabel: string | null
}

export type CustomDashboard = {
  counted: number
  resolved: number
  overview: { kills: number; averageDuration: number; blueWins: number; redWins: number }
  players: CustomPlayerLine[]
  records: CustomRecordLine[]
  champions: {
    championId: number
    championName: string
    games: number
    winRate: number | null
    players: number
  }[]
  duos: { a: CustomIdentity; b: CustomIdentity; games: number; wins: number; winRate: number }[]
}

/** A PC paired to send captured customs. The token itself is never in this. */
export type CaptureDevice = {
  id: number
  name: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

/** A custom game captured by the agent, as the admin list shows it. */
export type CustomGameSummary = {
  id: number
  label: string | null
  playedAt: string
  duration: number
  gameMode: string
  mapName: string | null
  playerCount: number
}

export type MemberAccount = {
  riotId: string
  platform: string
  profileIconId: number | null
  summonerLevel: number | null
  backfillState: 'pending' | 'running' | 'done' | 'failed'
  syncedFrom: string | null
}

export type GroupMember = {
  slug: string
  displayName: string
  accentColor: string | null
  accounts: MemberAccount[]
  ranks: MemberRank[]
  totals: {
    games: number
    wins: number
    winRate: number
    championsPlayed: number
    /** Arena only: Riot counts a podium as a win, so these are the games taken. */
    firstPlaces: number
  }
}

export type GroupOverview = {
  slug: string
  name: string
  timezone: string
  members: GroupMember[]
}

export type FeedMember = {
  memberSlug: string
  displayName: string
  accentColor: string | null
  riotId: string
  championId: number
  championName: string
  teamPosition: string | null
  teamId: number
  win: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  visionScore: number
  goldEarned: number
  items: number[]
  /** Raw perk selections; the UI reads the keystone and the secondary tree. */
  perks: unknown
  summonerSpells: [number, number]
  subteamPlacement: number | null
}

export type FeedMatch = {
  matchId: string
  queueId: number
  queueGroup: QueueGroup
  gameMode: string
  gameCreation: string
  gameDuration: number
  members: FeedMember[]
}

export type DailyFeed = {
  date: string
  timezone: string
  totals: {
    games: number
    memberGames: number
    wins: number
    losses: number
    winRate: number
    championsPlayed: number
  }
  matches: FeedMatch[]
}

export type LiveRank = {
  tier: string
  rank: string | null
  leaguePoints: number
  wins: number
  losses: number
}

export type LiveParticipant = {
  /** Null for a player Riot declines to identify in spectator data. */
  puuid: string | null
  teamId: number
  championId: number
  spell1Id: number
  spell2Id: number
  riotId: string | null
  tracked: boolean
  memberSlug: string | null
  displayName: string | null
  rank: LiveRank | null
}

export type LiveGame = {
  gameId: number
  platform: string
  queueId: number
  gameMode: string
  startedAt: string
  lengthSeconds: number
  participants: LiveParticipant[]
}

export type MatchDetailPlayer = {
  puuid: string
  riotId: string | null
  championId: number
  championName: string
  teamPosition: string | null
  win: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  goldEarned: number
  damageDealt: number
  visionScore: number
  champLevel: number
  items: number[]
  /** Raw perk selections; the UI reads the keystone and the secondary tree. */
  perks: unknown
  summonerSpells: [number, number]
  memberSlug: string | null
  displayName: string | null
  accentColor: string | null
}

export type MatchDetailSide = {
  id: number
  win: boolean
  placement: number | null
  kills: number
  goldEarned: number
  players: MatchDetailPlayer[]
}

export type MatchDetail = {
  matchId: string
  queueId: number
  queueGroup: QueueGroup
  gameMode: string
  gameCreation: string
  gameDuration: number
  sides: MatchDetailSide[]
}

export type ChampionPoolEntry = {
  championId: number
  championName: string
  games: number
  wins: number
  winRate: number
  kda: number
  averageCs: number
  lastPlayedAt: string
}

export type ChampionPool = {
  played: number
  available: number
  entries: ChampionPoolEntry[]
}

export type MatchHistoryEntry = {
  matchId: string
  queueGroup: QueueGroup
  queueId: number
  gameMode: string
  gameCreation: string
  gameDuration: number
  riotId: string
  championId: number
  championName: string
  teamPosition: string | null
  win: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  visionScore: number
  items: number[]
  subteamPlacement: number | null
}

export type MatchHistory = { entries: MatchHistoryEntry[]; nextCursor: string | null }

export type MemberProfile = {
  slug: string
  displayName: string
  avatarUrl: string | null
  accentColor: string | null
  accounts: (MemberAccount & { lastSyncedAt: string | null })[]
}

export type DuoPair = {
  a: string
  b: string
  games: number
  wins: number
  winRate: number
  soloWinRateA: number
  soloWinRateB: number
}

export type DuoStats = {
  pairs: DuoPair[]
  against: { a: string; b: string; games: number }[]
}

export type MemberTotals = {
  memberSlug: string
  displayName: string
  games: number
  wins: number
  winRate: number
  kills: number
  deaths: number
  assists: number
  kda: number
  csPerMinute: number
  visionPerGame: number
  deathsPerGame: number
  pentaKills: number
  lateNightGames: number
  championsPlayed: number
  /** Arena only: Riot counts a podium as a win, so these are the games taken. */
  firstPlaces: number
}

export type Board = {
  key: string
  label: string
  unit: string
  entries: { memberSlug: string; displayName: string; value: number }[]
}

export type Title = {
  key: string
  label: string
  description: string
  memberSlug: string
  displayName: string
  detail: string
}

export type Leaderboards = {
  period: 'week' | 'month' | 'all'
  from: string | null
  to: string
  minimumGames: number
  totals: MemberTotals[]
  boards: Board[]
  titles: Title[]
}

export type GroupChampion = {
  championId: number
  championName: string
  games: number
  wins: number
  winRate: number
  players: { memberSlug: string; displayName: string; games: number }[]
}

export type GroupChampionPool = {
  played: number
  available: number
  champions: GroupChampion[]
  untouched: { championId: number; championName: string }[]
}

export type ActivityDay = {
  date: string
  games: number
  memberGames: number
  wins: number
}

export type LpPoint = {
  capturedAt: string
  tier: string | null
  rank: string | null
  leaguePoints: number
  wins: number
  losses: number
}

export type LadderStanding = {
  /** Null for anyone below Master, where Riot publishes no order. */
  position: number | null
  apexPopulation?: number
  platform?: string
}

export type SiteStatus = {
  ingestion: {
    paused: boolean
    reason: 'key-rejected' | 'key-missing' | null
    since: string | null
  }
  lastMatchAt: string | null
}

export type ProfileCardStats = {
  mainRole: string | null
  roleShare: number | null
  hoursPlayed: number
  killParticipation: number | null
  bestStreak: number
  bestMultikill: { kind: 'penta' | 'quadra' | 'triple' | 'double'; count: number } | null
  bestChampion: { championName: string; games: number; winRate: number } | null
}

export type AdminAccount = {
  id: number
  riotId: string
  platform: string
  memberSlug: string
  displayName: string
  summonerLevel: number | null
  backfillState: 'pending' | 'running' | 'done' | 'failed'
  backfillError: string | null
  syncedFrom: string | null
  syncedTo: string | null
  lastSyncedAt: string | null
}

export type AdminStatus = {
  riotKey: {
    hasKey: boolean
    source: 'database' | 'env' | 'none'
    invalidSince: string | null
    fingerprint: string | null
  }
  budget: { windowSeconds: number; limit: number; used: number }[]
  accounts: AdminAccount[]
}

export type StaticData = {
  version: string | null
  champions: Record<string, { slug: string; name: string; title: string; tags: string[] }>
  summonerSpells: Record<string, { slug: string; name: string }>
  queues: Record<string, { description: string | null; map: string | null }>
  /** Styles and runes together, keyed by the id a match payload uses. */
  runes: Record<string, { kind: 'style' | 'perk'; name: string; image: string }>
}

/** Every stats call takes the same scope, so one control drives the whole site. */
type Scoped = { scope?: QueueScope }

/** Mirrors the API's fearless board: what a night has used up, worked out on every read. */
export type FearlessPick = {
  championId: number
  championName: string
  playerName: string
  memberSlug: string | null
  side: CustomSide
}

export type FearlessGame = {
  id: number
  /** 1, 2, 3… among the games that count; null for an excluded one. */
  number: number | null
  label: string | null
  playedAt: string
  endedAt: string
  excluded: boolean
  picks: FearlessPick[]
}

export type FearlessBurn = {
  championId: number
  source: 'played' | 'manual'
  by: { playerName: string; memberSlug: string | null; gameNumber: number }[]
}

export type FearlessBoard = {
  night: { id: number; label: string | null; startedAt: string; endsAt: string; active: boolean }
  games: FearlessGame[]
  burned: FearlessBurn[]
  freed: number[]
}

export const api = {
  health: () => apiFetch<HealthResponse>('/health'),
  status: () => apiFetch<SiteStatus>('/api/status'),
  staticData: () => apiFetch<StaticData>('/api/static'),
  group: (slug: string, params: Scoped = {}) =>
    apiFetch<GroupOverview>(`/api/groups/${slug}${searchOf(params)}`),
  feed: (slug: string, params: { date?: string } & Scoped = {}) =>
    apiFetch<DailyFeed>(`/api/groups/${slug}/feed${searchOf(params)}`),
  live: (slug: string) => apiFetch<{ games: LiveGame[] }>(`/api/groups/${slug}/live`),
  member: (slug: string) => apiFetch<MemberProfile>(`/api/members/${slug}`),
  championPool: (slug: string, params: Scoped = {}) =>
    apiFetch<ChampionPool>(`/api/members/${slug}/champions${searchOf(params)}`),
  matches: (slug: string, params: { cursor?: string; limit?: number } & Scoped = {}) =>
    apiFetch<MatchHistory>(`/api/members/${slug}/matches${searchOf(params)}`),
  lpHistory: (slug: string, params: { queueType?: string } = {}) =>
    apiFetch<{ points: LpPoint[] }>(`/api/members/${slug}/lp-history${searchOf(params)}`),
  duos: (slug: string, params: Scoped = {}) =>
    apiFetch<DuoStats>(`/api/groups/${slug}/duos${searchOf(params)}`),
  leaderboards: (slug: string, params: { period?: 'week' | 'month' | 'all' } & Scoped = {}) =>
    apiFetch<Leaderboards>(`/api/groups/${slug}/leaderboards${searchOf(params)}`),
  groupChampions: (slug: string, params: Scoped = {}) =>
    apiFetch<GroupChampionPool>(`/api/groups/${slug}/champions${searchOf(params)}`),
  ladder: (slug: string) => apiFetch<LadderStanding>(`/api/members/${slug}/ladder`),
  profileCard: (slug: string, params: Scoped = {}) =>
    apiFetch<ProfileCardStats>(`/api/members/${slug}/card${searchOf(params)}`),
  match: (slug: string, matchId: string) =>
    apiFetch<MatchDetail>(`/api/groups/${slug}/matches/${matchId}`),
  customGames: (slug: string) =>
    apiFetch<{ games: CustomGame[] }>(`/api/groups/${slug}/customs`),
  customDashboard: (slug: string) =>
    apiFetch<CustomDashboard>(`/api/groups/${slug}/customs/dashboard`),
  customStandings: (slug: string) =>
    apiFetch<CustomStandings>(`/api/groups/${slug}/customs/standings`),
  customGame: (slug: string, id: number) =>
    apiFetch<CustomGame>(`/api/groups/${slug}/customs/${id}`),
  /**
   * Null when the group never ran a fearless night (the API answers 204). Not
   * undefined: TanStack Query counts undefined data as a failed query.
   */
  fearless: async (slug: string) =>
    (await apiFetch<FearlessBoard | undefined>(`/api/groups/${slug}/fearless`)) ?? null,
  activity: (slug: string, params: Scoped = {}) =>
    apiFetch<{ days: ActivityDay[] }>(`/api/groups/${slug}/activity${searchOf(params)}`),

  session: () => apiFetch<{ authenticated: boolean; email: string | null }>('/api/admin/session'),
  signIn: (email: string, password: string) =>
    apiFetch<{ email: string }>('/api/admin/session', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  signOut: () => apiFetch<void>('/api/admin/session', { method: 'DELETE' }),

  adminStatus: () => apiFetch<AdminStatus>('/api/admin/status'),
  setRiotKey: (key: string) =>
    apiFetch<AdminStatus['riotKey']>('/api/admin/riot-key', {
      method: 'POST',
      body: JSON.stringify({ key }),
    }),
  addAccount: (
    group: string,
    payload: { riotId: string; platform: string; memberSlug?: string; memberName?: string }
  ) =>
    apiFetch<{ id: number; riotId: string; displayName: string }>(
      `/api/admin/groups/${group}/accounts`,
      { method: 'POST', body: JSON.stringify(payload) }
    ),
  removeAccount: (id: number) =>
    apiFetch<void>(`/api/admin/accounts/${id}`, { method: 'DELETE' }),
  resyncAccount: (id: number) =>
    apiFetch<{ id: number }>(`/api/admin/accounts/${id}/resync`, { method: 'POST' }),
  updateMember: (slug: string, payload: { displayName?: string; accentColor?: string | null }) =>
    apiFetch<{ slug: string }>(`/api/admin/members/${slug}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  customs: (group: string) =>
    apiFetch<CustomGameSummary[]>(`/api/admin/groups/${group}/customs`),
  uploadCustom: (
    group: string,
    payload: { capture: unknown; fileName: string; capturedAt: string; label?: string }
  ) =>
    apiFetch<CustomGameSummary & { duplicate: boolean }>(
      `/api/admin/groups/${group}/customs`,
      { method: 'POST', body: JSON.stringify(payload) }
    ),
  removeCustom: (id: number) =>
    apiFetch<void>(`/api/admin/customs/${id}`, { method: 'DELETE' }),
  captureDevices: (group: string) =>
    apiFetch<CaptureDevice[]>(`/api/admin/groups/${group}/devices`),
  /** The one response that carries the token - it is not stored and cannot be shown again. */
  pairCaptureDevice: (group: string, name: string) =>
    apiFetch<{ id: number; name: string; token: string }>(`/api/admin/groups/${group}/devices`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  revokeCaptureDevice: (id: number) =>
    apiFetch<void>(`/api/admin/devices/${id}`, { method: 'DELETE' }),

  /** `winner: null` hands the result back to the capture. */
  updateCustom: (id: number, patch: { winner?: CustomSide | null; label?: string | null }) =>
    apiFetch<{ id: number; label: string | null; winnerOverride: CustomSide | null }>(
      `/api/admin/customs/${id}`,
      { method: 'PATCH', body: JSON.stringify(patch) }
    ),
  startFearless: (group: string, label?: string) =>
    apiFetch<FearlessBoard>(`/api/admin/groups/${group}/fearless`, {
      method: 'POST',
      body: JSON.stringify({ label: label || null }),
    }),
  updateFearless: (
    id: number,
    patch: { label?: string | null; ended?: true; excludedCustomIds?: number[] }
  ) =>
    apiFetch<FearlessBoard>(`/api/admin/fearless/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  adjustFearless: (id: number, championId: number, kind: 'burn' | 'free') =>
    apiFetch<FearlessBoard>(`/api/admin/fearless/${id}/champions/${championId}`, {
      method: 'PUT',
      body: JSON.stringify({ kind }),
    }),
  unadjustFearless: (id: number, championId: number) =>
    apiFetch<FearlessBoard>(`/api/admin/fearless/${id}/champions/${championId}`, {
      method: 'DELETE',
    }),
}

function searchOf(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.append(key, String(value))
    }
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}
