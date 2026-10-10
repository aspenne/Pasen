import type { HttpContext } from '@adonisjs/core/http'

import Group from '#models/group'
import { FearlessService } from '#fearless/fearless_service'

/** The night in progress, or the last one - open to everyone, like the rest of the site. */
export default class FearlessController {
  async show({ params, response }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    const service = new FearlessService()
    const night = await service.latest(group)
    if (!night) return response.noContent()
    return response.ok(await service.board(night))
  }
}
