/**
 * Turns a stored agent capture into what a page can draw.
 *
 * Pure on purpose: the capture is the only copy of the game, its shape is
 * Riot's Live Client payload rather than match-v5, and the three things it does
 * not carry - a winning team, a champion id, a link from an event to a player -
 * all have to be reconstructed. Each reconstruction is tested against a real
 * capture rather than against a guess at one.
 */

export type Side = 'ORDER' | 'CHAOS'

export type CustomPlayerView = {
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
  /** Seven slots by position, trinket last, zero for an empty slot. */
  items: number[]
  /** Shaped like match-v5's perks, so the existing rune component reads it as is. */
  perks: { styles: { style: number; selections?: { perk: number }[] }[] }
  summonerSpells: [number, number]
  /** Longest multikill, 0 when none. 5 is a pentakill. */
  bestMultikill: number
  /** Each multikill counted once, at its peak - a penta is not also a quadra. */
  multikills: { double: number; triple: number; quadra: number; penta: number }
  firstBlood: boolean
}

export type CustomTeamView = {
  side: Side
  /** Blue is ORDER, red is CHAOS - the client's own naming, kept for the key. */
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
  players: CustomPlayerView[]
}

export type CustomGameView = {
  id: number
  label: string | null
  playedAt: string
  duration: number
  gameMode: string
  mapName: string | null
  /** Who ran the agent: the result in the capture is from their point of view. */
  capturedBy: string | null
  /** False when nothing settles it: no GameEnd in the capture, and nobody decided by hand. */
  resultKnown: boolean
  /** Where the result came from - the capture, a person, or nowhere. */
  resultSource: 'capture' | 'manual' | null
  /** True when every player but the capturer is a bot - practice, not an inhouse. */
  againstBots: boolean
  firstBlood: string | null
  teams: CustomTeamView[]
}

export type ViewLookups = {
  /** Data Dragon slug ("MasterYi") to numeric champion id. */
  championIdBySlug: Map<string, number>
  /** Spell slug ("SummonerFlash") to numeric id. */
  spellIdBySlug: Map<string, number>
  /** "Name#TAG", lower-cased, to the member who owns that account. */
  memberByRiotId: Map<string, { slug: string; displayName: string }>
}

export type StoredCustom = {
  id: number
  label: string | null
  /** A winner decided by hand, which beats whatever the capture implies. */
  winnerOverride?: Side | null
  playedAt: string
  duration: number
  gameMode: string
  mapName: string | null
  raw: unknown
}

type RawPlayer = {
  team?: string
  isBot?: boolean
  riotId?: string
  riotIdGameName?: string
  summonerName?: string
  championName?: string
  rawChampionName?: string
  position?: string
  level?: number
  scores?: { kills?: number; deaths?: number; assists?: number; creepScore?: number; wardScore?: number }
  items?: { slot?: number; itemID?: number }[]
  runes?: {
    keystone?: { id?: number }
    primaryRuneTree?: { id?: number }
    secondaryRuneTree?: { id?: number }
  }
  summonerSpells?: {
    summonerSpellOne?: { rawDisplayName?: string }
    summonerSpellTwo?: { rawDisplayName?: string }
  }
}

type RawEvent = {
  EventName?: string
  KillerName?: string
  KillStreak?: number
  Recipient?: string
  Result?: string
  TurretKilled?: string
  InhibKilled?: string
}

type RawCapture = {
  activePlayer?: { riotId?: string }
  allPlayers?: RawPlayer[]
  events?: { Events?: RawEvent[] }
}

/** Map codes Riot uses in `mapName`, for the ones a custom is ever played on. */
const MAP_NAMES: Record<string, string> = {
  Map11: "Summoner's Rift",
  Map12: 'Howling Abyss',
  Map30: 'Rings of Wrath',
}

export function viewCustomGame(game: StoredCustom, lookups: ViewLookups): CustomGameView {
  const raw = (game.raw ?? {}) as RawCapture
  const players = raw.allPlayers ?? []
  const events = raw.events?.Events ?? []

  /*
   * Events name people, not accounts: a human by their game name without the
   * tag, a bot by its champion and the word Bot - "Cassiopeia Bot". Every name
   * an event could use is mapped to a side once, so objectives can be credited.
   */
  const sideByName = new Map<string, Side>()
  for (const player of players) {
    const side = sideOf(player.team)
    if (!side) continue
    for (const name of [
      player.riotIdGameName,
      player.summonerName,
      player.riotId?.split('#')[0],
      player.isBot ? `${player.championName} Bot` : undefined,
    ]) {
      if (name) sideByName.set(name, side)
    }
  }

  const streaks = multikillsByName(events)
  const firstBlood = events.find((event) => event.EventName === 'FirstBlood')?.Recipient ?? null

  /*
   * A person's decision beats the capture's. The capture only ever knew the
   * result from the seat of whoever ran the agent - and nothing at all when it
   * was saved from the window closing.
   */
  const captured = winningSide(raw, players, events)
  const winner = game.winnerOverride ?? captured
  const resultSource = game.winnerOverride ? 'manual' : captured ? 'capture' : null
  const capturer = raw.activePlayer?.riotId ?? null

  const teams: CustomTeamView[] = (['ORDER', 'CHAOS'] as const).map((side) => {
    const own = players.filter((player) => sideOf(player.team) === side)
    const viewed = own.map((player) => viewPlayer(player, lookups, streaks, firstBlood))

    return {
      side,
      won: winner === null ? null : winner === side,
      kills: viewed.reduce((sum, player) => sum + player.kills, 0),
      objectives: objectivesFor(side, events, sideByName),
      players: viewed,
    }
  })

  const humans = players.filter((player) => !player.isBot)

  return {
    id: game.id,
    label: game.label,
    playedAt: game.playedAt,
    duration: game.duration,
    gameMode: game.gameMode,
    mapName: game.mapName ? (MAP_NAMES[game.mapName] ?? game.mapName) : null,
    capturedBy: capturer,
    resultKnown: winner !== null,
    resultSource,
    againstBots: humans.length <= 1 && players.length > 1,
    firstBlood,
    teams,
  }
}

function sideOf(team: string | undefined): Side | null {
  return team === 'ORDER' || team === 'CHAOS' ? team : null
}

/**
 * The capture never says which team won. `GameEnd` carries "Win" or "Lose",
 * and that is from the point of view of whoever ran the agent - so the answer
 * is their side, or the other one. With no `GameEnd` at all (the capture came
 * from the window closing) there is nothing to read, and saying so beats a
 * guess drawn from turret counts.
 */
function winningSide(raw: RawCapture, players: RawPlayer[], events: RawEvent[]): Side | null {
  const end = events.find((event) => event.EventName === 'GameEnd')
  if (!end?.Result) return null

  const capturer = raw.activePlayer?.riotId
  const own = sideOf(players.find((player) => player.riotId === capturer)?.team)
  if (!own) return null

  const result = end.Result.toLowerCase()
  if (result === 'win') return own
  if (result === 'lose') return own === 'ORDER' ? 'CHAOS' : 'ORDER'
  return null
}

function viewPlayer(
  player: RawPlayer,
  lookups: ViewLookups,
  streaks: Map<string, Multikills>,
  firstBlood: string | null
): CustomPlayerView {
  const riotId = player.riotId ?? player.summonerName ?? 'Unknown'
  const member = player.isBot ? undefined : lookups.memberByRiotId.get(riotId.toLowerCase())
  const scores = player.scores ?? {}

  const items = Array.from({ length: 7 }, () => 0)
  for (const item of player.items ?? []) {
    if (typeof item.slot === 'number' && item.slot >= 0 && item.slot < 7 && item.itemID) {
      items[item.slot] = item.itemID
    }
  }

  const keystone = player.runes?.keystone?.id ?? 0
  const primary = player.runes?.primaryRuneTree?.id ?? 0
  const secondary = player.runes?.secondaryRuneTree?.id ?? 0

  const gameName = player.riotIdGameName ?? riotId.split('#')[0]
  // How events refer to this player: a human by game name, a bot as "Ahri Bot".
  const eventName = player.isBot ? `${player.championName} Bot` : gameName

  return {
    riotId,
    // A bot is called "Ahri#BOT"; what anyone wants to read is the champion.
    name: player.isBot ? `${player.championName ?? 'Bot'} (bot)` : gameName,
    isBot: Boolean(player.isBot),
    memberSlug: member?.slug ?? null,
    displayName: member?.displayName ?? null,
    championId: championIdOf(player, lookups),
    championName: player.championName ?? 'Unknown',
    position: player.position && player.position !== 'NONE' ? player.position : null,
    level: player.level ?? 0,
    kills: scores.kills ?? 0,
    deaths: scores.deaths ?? 0,
    assists: scores.assists ?? 0,
    cs: scores.creepScore ?? 0,
    wardScore: Math.round((scores.wardScore ?? 0) * 10) / 10,
    items,
    perks: {
      styles: [
        { style: primary, selections: [{ perk: keystone }] },
        { style: secondary },
      ],
    },
    summonerSpells: [
      spellIdOf(player.summonerSpells?.summonerSpellOne?.rawDisplayName, lookups),
      spellIdOf(player.summonerSpells?.summonerSpellTwo?.rawDisplayName, lookups),
    ],
    ...multikillFields(streaks.get(eventName)),
    firstBlood: !player.isBot && firstBlood === gameName,
  }
}

type Multikills = { double: number; triple: number; quadra: number; penta: number }

function multikillFields(counts: Multikills | undefined) {
  const multikills = counts ?? { double: 0, triple: 0, quadra: 0, penta: 0 }
  const bestMultikill = multikills.penta
    ? 5
    : multikills.quadra
      ? 4
      : multikills.triple
        ? 3
        : multikills.double
          ? 2
          : 0
  return { multikills, bestMultikill }
}

/**
 * Multikills by the name events use, each counted once at its peak.
 *
 * The client reports a streak as it grows: a pentakill arrives as 2, 3, 4,
 * then 5, a few seconds apart. Counting every event would also credit a
 * double, a triple and a quadra inside the one penta - so a run that climbs by
 * one for the same killer is a single multikill, recorded where it stops.
 */
function multikillsByName(events: RawEvent[]): Map<string, Multikills> {
  const counts = new Map<string, Multikills>()
  const open = new Map<string, number>()

  const close = (name: string) => {
    const peak = open.get(name)
    if (!peak) return
    open.delete(name)
    const tally = counts.get(name) ?? { double: 0, triple: 0, quadra: 0, penta: 0 }
    if (peak === 2) tally.double++
    else if (peak === 3) tally.triple++
    else if (peak === 4) tally.quadra++
    else if (peak >= 5) tally.penta++
    counts.set(name, tally)
  }

  for (const event of events) {
    if (event.EventName !== 'Multikill' || !event.KillerName) continue
    const streak = event.KillStreak ?? 0
    const current = open.get(event.KillerName)
    if (current !== undefined && streak !== current + 1) close(event.KillerName)
    open.set(event.KillerName, streak)
  }
  for (const name of [...open.keys()]) close(name)

  return counts
}

/**
 * The capture has no champion id, only "game_character_displayname_MasterYi" -
 * whose tail is exactly the Data Dragon slug. The display name with its spaces
 * and punctuation stripped is the fallback, which covers Master Yi and Kai'Sa
 * alike should the raw name ever be missing.
 */
function championIdOf(player: RawPlayer, lookups: ViewLookups): number {
  const fromRaw = player.rawChampionName?.match(/displayname_(.+)$/)?.[1]
  if (fromRaw && lookups.championIdBySlug.has(fromRaw)) return lookups.championIdBySlug.get(fromRaw)!

  const squashed = (player.championName ?? '').replace(/[^A-Za-z]/g, '')
  for (const [slug, id] of lookups.championIdBySlug) {
    if (slug.toLowerCase() === squashed.toLowerCase()) return id
  }
  return 0
}

/** "GeneratedTip_SummonerSpell_SummonerFlash_DisplayName" carries the slug in its third part. */
function spellIdOf(raw: string | undefined, lookups: ViewLookups): number {
  const slug = raw?.split('_')[2]
  return (slug && lookups.spellIdBySlug.get(slug)) || 0
}

/**
 * Objectives per side. Structures are credited by the name of what fell -
 * "Turret_TChaos_..." is a Chaos turret, so Order took it - because a turret
 * is often finished by minions, and a minion is no one's name. Monsters are
 * credited through whoever the event names as the killer.
 */
function objectivesFor(side: Side, events: RawEvent[], sideByName: Map<string, Side>) {
  const enemy = side === 'ORDER' ? 'TChaos' : 'TOrder'
  const takenBy = (name?: string) => (name ? sideByName.get(name) === side : false)

  return {
    turrets: events.filter((e) => e.EventName === 'TurretKilled' && e.TurretKilled?.includes(enemy)).length,
    inhibitors: events.filter((e) => e.EventName === 'InhibKilled' && e.InhibKilled?.includes(enemy)).length,
    dragons: events.filter((e) => e.EventName === 'DragonKill' && takenBy(e.KillerName)).length,
    grubs: events.filter((e) => e.EventName === 'HordeKill' && takenBy(e.KillerName)).length,
    heralds: events.filter((e) => e.EventName === 'HeraldKill' && takenBy(e.KillerName)).length,
    barons: events.filter((e) => e.EventName === 'BaronKill' && takenBy(e.KillerName)).length,
  }
}
