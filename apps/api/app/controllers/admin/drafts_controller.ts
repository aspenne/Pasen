import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'

import Draft from '#models/draft'
import { DraftService } from '#drafts/draft_service'

const sideInput = vine.compile(vine.object({ side: vine.enum(['blue', 'red'] as const) }))

/** The admin's way out: a seat someone walked away from, a draft that went wrong. */
export default class AdminDraftsController {
  async freeSeat({ params, response }: HttpContext) {
    const draft = await Draft.findOrFail(params.id)
    const { side } = await sideInput.validate({ side: params.side })
    await new DraftService().freeSeat(draft, side)
    return response.noContent()
  }

  async destroy({ params, response }: HttpContext) {
    const draft = await Draft.findOrFail(params.id)
    await draft.delete()
    return response.noContent()
  }
}
