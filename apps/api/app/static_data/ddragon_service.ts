import type { Logger } from '@adonisjs/core/logger'
import db from '@adonisjs/lucid/services/db'

import Setting from '#models/setting'
import StaticChampion from '#models/static_champion'
import StaticItem from '#models/static_item'
import StaticQueue from '#models/static_queue'
import StaticSummonerSpell from '#models/static_summoner_spell'

const DDRAGON = 'https://ddragon.leagueoflegends.com'
const QUEUES_URL = 'https://static.developer.riotgames.com/docs/lol/queues.json'
const VERSION_SETTING = 'ddragon.version'

/** Interface names come from Data Dragon, which is why they are not camelCase. */
type ChampionEntry = {
  key: string
  id: string
  name: string
  title: string
  tags: string[]
  image: { full: string }
}

type ItemEntry = {
  name: string
  plaintext?: string
  gold?: { total?: number }
  image: { full: string }
}

type SpellEntry = {
  key: string
  id: string
  name: string
  image: { full: string }
}

type QueueEntry = {
  queueId: number
  map: string | null
  description: string | null
  notes: string | null
}

export type SyncResult = {
  version: string
  skipped: boolean
  champions: number
  items: number
  summonerSpells: number
  queues: number
}

/**
 * Mirrors Riot's reference data locally.
 *
 * Data Dragon is a public CDN, not the game API: it needs no key and is not
 * covered by the 100-requests-per-two-minutes budget. It therefore does NOT go
 * through RiotGateway - routing it there would spend match-fetching budget on
 * static files that change once a patch.
 */
export class DDragonService {
  readonly #fetch: typeof fetch
  readonly #logger?: Logger
  readonly #locale: string

  constructor(options: { fetch?: typeof fetch; logger?: Logger; locale?: string } = {}) {
    this.#fetch = options.fetch ?? globalThis.fetch
    this.#logger = options.logger
    this.#locale = options.locale ?? 'en_US'
  }

  async latestVersion(): Promise<string> {
    const versions = await this.#json<string[]>(`${DDRAGON}/api/versions.json`)
    if (!versions.length) {
      throw new Error('Data Dragon returned no versions')
    }
    return versions[0]
  }

  async syncedVersion(): Promise<string | null> {
    const setting = await Setting.find(VERSION_SETTING)
    return (setting?.value as string | undefined) ?? null
  }

  /**
   * Re-imports everything when the patch moved. `force` re-imports anyway, which
   * is what you want after adding a column to one of the static tables.
   */
  async sync(options: { force?: boolean } = {}): Promise<SyncResult> {
    const version = await this.latestVersion()
    const current = await this.syncedVersion()

    if (current === version && !options.force) {
      this.#logger?.info({ version }, 'data dragon already current')
      return { version, skipped: true, champions: 0, items: 0, summonerSpells: 0, queues: 0 }
    }

    this.#logger?.info({ version, previous: current }, 'syncing data dragon')

    const [champions, items, spells, queues] = await Promise.all([
      this.#json<{ data: Record<string, ChampionEntry> }>(this.#cdn(version, 'champion')),
      this.#json<{ data: Record<string, ItemEntry> }>(this.#cdn(version, 'item')),
      this.#json<{ data: Record<string, SpellEntry> }>(this.#cdn(version, 'summoner')),
      this.#json<QueueEntry[]>(QUEUES_URL),
    ])

    const championRows = Object.values(champions.data).map((champion) => ({
      // Data Dragon types the championId as a string; match payloads use a number.
      id: Number(champion.key),
      slug: champion.id,
      name: champion.name,
      title: champion.title,
      tags: champion.tags ?? [],
      image: champion.image.full,
      version,
    }))

    const itemRows = Object.entries(items.data)
      // A handful of Data Dragon keys are not numeric ids; they have no
      // counterpart in match payloads, so they are dropped rather than coerced.
      .filter(([id]) => /^\d+$/.test(id))
      .map(([id, item]) => ({
        id: Number(id),
        name: item.name,
        plaintext: item.plaintext || null,
        goldTotal: item.gold?.total ?? 0,
        image: item.image.full,
        version,
      }))

    const spellRows = Object.values(spells.data).map((spell) => ({
      id: Number(spell.key),
      slug: spell.id,
      name: spell.name,
      image: spell.image.full,
      version,
    }))

    const queueRows = queues.map((queue) => ({
      queueId: queue.queueId,
      map: queue.map,
      description: queue.description,
      notes: queue.notes,
    }))

    // One transaction: a half-imported patch would show blank champion names on
    // every page until the next run.
    await db.transaction(async (client) => {
      await StaticChampion.updateOrCreateMany('id', championRows, { client })
      await StaticItem.updateOrCreateMany('id', itemRows, { client })
      await StaticSummonerSpell.updateOrCreateMany('id', spellRows, { client })
      await StaticQueue.updateOrCreateMany('queueId', queueRows, { client })
    })

    await Setting.updateOrCreate({ key: VERSION_SETTING }, { value: version })

    return {
      version,
      skipped: false,
      champions: championRows.length,
      items: itemRows.length,
      summonerSpells: spellRows.length,
      queues: queueRows.length,
    }
  }

  #cdn(version: string, file: 'champion' | 'item' | 'summoner') {
    return `${DDRAGON}/cdn/${version}/data/${this.#locale}/${file}.json`
  }

  async #json<T>(url: string): Promise<T> {
    const response = await this.#fetch(url)
    if (!response.ok) {
      throw new Error(`Data Dragon request failed: ${response.status} ${url}`)
    }
    return (await response.json()) as T
  }
}
