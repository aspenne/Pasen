import type { HttpContext } from '@adonisjs/core/http'

import Group from '#models/group'
import { LesService } from '#les/les_service'

/** Road to LES, open to everyone like the rest of the site. */
export default class LesController {
  async show({ params, response }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    return response.ok(await new LesService().board(group))
  }
}
