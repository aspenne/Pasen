import type { HttpContext } from '@adonisjs/core/http'

import Setting from '#models/setting'
import StaticChampion from '#models/static_champion'
import StaticQueue from '#models/static_queue'
import StaticSummonerSpell from '#models/static_summoner_spell'

/**
 * Reference data the browser needs to turn ids into names and artwork. Served
 * from our own tables rather than proxied: the images themselves come straight
 * from the Data Dragon CDN, so this is a few kilobytes of lookup, fetched once
 * and cached for the session.
 */
export default class StaticController {
  async index({ response }: HttpContext) {
    const [version, champions, spells, queues] = await Promise.all([
      Setting.find('ddragon.version'),
      StaticChampion.query().select('id', 'slug', 'name', 'title', 'tags'),
      StaticSummonerSpell.query().select('id', 'slug', 'name'),
      StaticQueue.query().select('queueId', 'description', 'map'),
    ])

    // The patch only moves once every couple of weeks, and every id below is
    // stable within it, so this is worth caching hard in the browser.
    response.header('Cache-Control', 'public, max-age=3600')

    return {
      version: (version?.value as string | undefined) ?? null,
      champions: Object.fromEntries(
        champions.map((champion) => [
          champion.id,
          { slug: champion.slug, name: champion.name, title: champion.title, tags: champion.tags },
        ])
      ),
      summonerSpells: Object.fromEntries(
        spells.map((spell) => [spell.id, { slug: spell.slug, name: spell.name }])
      ),
      queues: Object.fromEntries(
        queues.map((queue) => [queue.queueId, { description: queue.description, map: queue.map }])
      ),
    }
  }
}
