import db from '@adonisjs/lucid/services/db'
import type { Logger } from '@adonisjs/core/logger'

import StaticChampion from '#models/static_champion'

/** The five lanes, in the order every screen lists them. */
export const ROLE_ORDER = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const
export type Role = (typeof ROLE_ORDER)[number]

/**
 * Meraki Analytics publishes the lanes each champion is played in, refreshed
 * every patch. Riot itself only gives classes (Mage, Fighter), which say
 * nothing about where a champion goes.
 */
const MERAKI = 'https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json'

/** Below this many stored games, where a champion was played is chance, not a role. */
const MIN_GAMES = 3

type Meraki = Record<string, { id: number; positions?: string[] }>
type Played = Map<number, { position: string; games: number }[]>

const fromMeraki = (position: string): Role | null => {
  const role = position === 'SUPPORT' ? 'UTILITY' : position
  return (ROLE_ORDER as readonly string[]).includes(role) ? (role as Role) : null
}

/**
 * Each champion's roles: Meraki's, else the lane the stored games play it in
 * most (a champion out this week is not in Meraki yet), else none.
 */
export function championRoles(ids: number[], meraki: Meraki, played: Played): Map<number, Role[]> {
  const byId = new Map(Object.values(meraki).map((entry) => [entry.id, entry.positions ?? []]))
  const roles = new Map<number, Role[]>()
  for (const id of ids) {
    const known = (byId.get(id) ?? []).map(fromMeraki).filter((role): role is Role => role !== null)
    if (known.length > 0) {
      roles.set(id, ROLE_ORDER.filter((role) => known.includes(role)))
      continue
    }
    const top = (played.get(id) ?? []).filter((p) => p.games >= MIN_GAMES).sort((a, b) => b.games - a.games)[0]
    const role = top ? fromMeraki(top.position) : null
    roles.set(id, role ? [role] : [])
  }
  return roles
}

/**
 * Writes the roles into static_champions. A Meraki outage keeps the roles
 * already stored rather than wiping them: they change once a patch at most.
 */
export class ChampionRoleService {
  constructor(private options: { fetch?: typeof fetch; logger?: Logger } = {}) {}

  async sync(): Promise<number> {
    let meraki: Meraki
    try {
      const response = await (this.options.fetch ?? globalThis.fetch)(MERAKI, { signal: AbortSignal.timeout(20_000) })
      if (!response.ok) throw new Error(`Meraki answered ${response.status}`)
      meraki = (await response.json()) as Meraki
    } catch (error) {
      this.options.logger?.warn({ err: (error as Error).message }, 'champion roles not refreshed')
      return 0
    }

    const champions = await StaticChampion.query().select('id')
    /*
     * A 200 carrying an empty or reshaped body would otherwise wipe every
     * champion's roles: too few champions recognised means keep what we have.
     */
    const known = new Set(Object.values(meraki ?? {}).map((entry) => entry?.id))
    const matched = champions.filter((champion) => known.has(champion.id)).length
    if (matched < Math.min(100, champions.length / 2)) {
      this.options.logger?.warn({ matched }, 'Meraki answered with too little; champion roles kept')
      return 0
    }
    const rows = await db
      .from('match_participants')
      .whereNotNull('team_position')
      .groupBy('champion_id', 'team_position')
      .select('champion_id', 'team_position')
      .count('* as games')
    const played: Played = new Map()
    for (const row of rows) {
      const list = played.get(Number(row.champion_id)) ?? []
      list.push({ position: row.team_position, games: Number(row.games) })
      played.set(Number(row.champion_id), list)
    }

    const roles = championRoles(champions.map((c) => c.id), meraki, played)
    await db.transaction(async (trx) => {
      for (const [id, list] of roles) {
        await trx.from('static_champions').where('id', id).update({ positions: JSON.stringify(list) })
      }
    })
    return roles.size
  }
}
