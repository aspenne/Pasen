import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DRAFT_ROLES } from '@pasen/shared'

import Draft from '#models/draft'
import Group from '#models/group'
import { DraftError, DraftService } from '#drafts/draft_service'

const sideInput = vine.compile(vine.object({ side: vine.enum(['blue', 'red'] as const) }))
const hoverInput = vine.compile(vine.object({ championId: vine.number().withoutDecimals().positive().nullable() }))
const actionInput = vine.compile(
  vine.object({
    championId: vine.number().withoutDecimals().positive(),
    role: vine.enum(DRAFT_ROLES).nullable().optional(),
  })
)

/**
 * The draft as everyone sees it, and the captains' moves. A seat token rides in
 * the x-draft-seat header, never in a URL: whoever holds it plays that side.
 */
export default class DraftsController {
  async current({ params, response }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    const service = new DraftService()
    const draft = await service.current(group)
    if (!draft) return response.noContent()
    return response.ok(await service.view(draft))
  }

  async index({ params, request, response }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    const night = Number(request.input('night'))
    if (!Number.isInteger(night)) return response.ok({ drafts: [] })
    return response.ok({ drafts: await new DraftService().history(group, night) })
  }

  async store(ctx: HttpContext) {
    const group = await Group.findByOrFail('slug', ctx.params.slug)
    return this.#run(ctx, async (service) => ctx.response.created(await service.view(await service.create(group))))
  }

  async takeSeat(ctx: HttpContext) {
    const draft = await this.#draft(ctx)
    const { side } = await sideInput.validate(ctx.request.all())
    return this.#run(ctx, async (service) => ctx.response.created({ side, token: await service.takeSeat(draft, side) }))
  }

  async leaveSeat(ctx: HttpContext) {
    const draft = await this.#draft(ctx)
    const { side } = await sideInput.validate({ side: ctx.params.side })
    return this.#run(ctx, async (service) => {
      await service.leaveSeat(draft, side, ctx.request.header('x-draft-seat'))
      return ctx.response.noContent()
    })
  }

  async hover(ctx: HttpContext) {
    const draft = await this.#draft(ctx)
    const { championId } = await hoverInput.validate(ctx.request.all())
    return this.#run(ctx, async (service) => {
      await service.hover(draft, ctx.request.header('x-draft-seat'), championId)
      return ctx.response.ok({ hover: championId })
    })
  }

  async act(ctx: HttpContext) {
    const draft = await this.#draft(ctx)
    const { championId, role } = await actionInput.validate(ctx.request.all())
    return this.#run(ctx, async (service) => {
      await service.act(draft, ctx.request.header('x-draft-seat'), championId, role ?? null)
      return ctx.response.created(await service.view(draft))
    })
  }

  async #draft({ params }: HttpContext): Promise<Draft> {
    const group = await Group.findByOrFail('slug', params.slug)
    return Draft.query().where('group_id', group.id).where('id', params.id).firstOrFail()
  }

  async #run(ctx: HttpContext, work: (service: DraftService) => Promise<unknown>) {
    try {
      return await work(new DraftService())
    } catch (error) {
      if (error instanceof DraftError) return ctx.response.status(error.status).json({ message: error.message })
      throw error
    }
  }
}
