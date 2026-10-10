import type { HttpContext } from '@adonisjs/core/http'

import Group from '#models/group'
import { RouletteService } from '#roulette/roulette_service'

/**
 * The roulette as every page sees it. `show` is polled every two seconds by
 * everyone watching, so it reads two rows and nothing else; the profile cards,
 * which do not change during an evening, come from `cards`, once per lobby.
 */
export default class RouletteController {
  async show({ params, response }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    return response.ok(await new RouletteService().view(group))
  }

  async cards({ params, response }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    return response.ok({ cards: await new RouletteService().cards(group) })
  }
}
