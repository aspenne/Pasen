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

export type MemberRank = {
  queueType: string
  tier: string | null
  rank: string | null
  leaguePoints: number
  wins: number
  losses: number
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
  totals: { games: number; wins: number; winRate: number; championsPlayed: number }
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

export type LiveParticipant = {
  puuid: string
  teamId: number
  championId: number
  spell1Id: number
  spell2Id: number
  riotId: string | null
  tracked: boolean
  memberSlug: string | null
  displayName: string | null
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
  kda: number
  csPerMinute: number
  visionPerGame: number
  deathsPerGame: number
  pentaKills: number
  lateNightGames: number
  championsPlayed: number
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
}

/** Every stats call takes the same scope, so one control drives the whole site. */
type Scoped = { scope?: QueueScope }

export const api = {
  health: () => apiFetch<HealthResponse>('/health'),
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
