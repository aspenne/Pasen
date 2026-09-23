import type { HttpContext } from '@adonisjs/core/http'

import Setting from '#models/setting'
import StaticChampion from '#models/static_champion'
import StaticQueue from '#models/static_queue'
import StaticRune from '#models/static_rune'
import StaticSummonerSpell from '#models/static_summoner_spell'

/**
 * Reference data the browser needs to turn ids into names and artwork. Served
 * from our own tables rather than proxied: the images themselves come straight
 * from the Data Dragon CDN, so this is a few kilobytes of lookup, fetched once
 * and cached for the session.
 */
export default class StaticController {
  async index({ response }: HttpContext) {
    const [version, champions, spells, queues, runes] = await Promise.all([
      Setting.find('ddragon.version'),
      StaticChampion.query().select('id', 'slug', 'name', 'title', 'tags'),
      StaticSummonerSpell.query().select('id', 'slug', 'name'),
      StaticQueue.query().select('queueId', 'description', 'map'),
      StaticRune.query().select('id', 'kind', 'name', 'image'),
    ])

    // The patch only moves once every couple of weeks, and every id below is
    // stable within it, so this is worth caching hard in the browser.
    /*
     * Short freshness, long grace. A browser holding an older copy of this
     * payload is missing whichever key was added since - and a lookup into a
     * key that is not there throws, which is how adding runes broke exactly one
     * device and no others. Five minutes of hard caching keeps the request
     * cheap; the hour of stale-while-revalidate keeps it instant while the new
     * copy arrives in the background.
     */
    response.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')

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
      // The image path is stored whole, because Data Dragon serves rune art
      // from an unversioned root and the path already carries the tree.
      runes: Object.fromEntries(
        runes.map((rune) => [rune.id, { kind: rune.kind, name: rune.name, image: rune.image }])
      ),
    }
  }
}
