import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'

import Draft from '#models/draft'
import { DraftError, DraftService } from '#drafts/draft_service'

const sideInput = vine.compile(vine.object({ side: vine.enum(['blue', 'red'] as const) }))

/** The admin's way out: a seat someone walked away from, a draft that went wrong. */
export default class AdminDraftsController {
  async freeSeat({ params, response }: HttpContext) {
    const draft = await Draft.findOrFail(params.id)
    const { side } = await sideInput.validate({ side: params.side })
    await new DraftService().freeSeat(draft, side)
    return response.noContent()
  }

  /** Takes back the last pick or ban, whoever locked it. */
  async undo({ params, response }: HttpContext) {
    const draft = await Draft.findOrFail(params.id)
    const service = new DraftService()
    try {
      await service.undoLast(draft, 'admin')
    } catch (error) {
      if (error instanceof DraftError) return response.status(error.status).json({ message: error.message })
      throw error
    }
    return response.ok(await service.view(draft))
  }

  async destroy({ params, response }: HttpContext) {
    const draft = await Draft.findOrFail(params.id)
    await draft.delete()
    return response.noContent()
  }
}
