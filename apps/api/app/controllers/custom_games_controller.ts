import type { HttpContext } from '@adonisjs/core/http'

import Group from '#models/group'
import { CustomGameReader } from '#customs/custom_game_reader'

/**
 * The public side of captured customs. Open like every other read here: the
 * site is meant to be shared, and only the upload sits behind the session.
 */
export default class CustomGamesController {
  async index({ params, response }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    return response.ok({ games: await new CustomGameReader().list(group) })
  }

  async standings({ params, response }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    return response.ok(await new CustomGameReader().standings(group))
  }

  async show({ params, response }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    const game = await new CustomGameReader().find(group, Number(params.id))
    if (!game) return response.notFound({ message: 'No custom game with that id in this group.' })
    return response.ok(game)
  }
}
