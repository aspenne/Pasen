import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

import CustomGame from '#models/custom_game'
import FearlessAdjustment from '#models/fearless_adjustment'
import FearlessNight from '#models/fearless_night'
import Group from '#models/group'
import StaticChampion from '#models/static_champion'
import { FearlessService } from '#fearless/fearless_service'

const startNight = vine.compile(
  vine.object({ label: vine.string().trim().maxLength(80).nullable().optional() })
)

const nightPatch = vine.compile(
  vine.object({
    label: vine.string().trim().maxLength(80).nullable().optional(),
    ended: vine.boolean().optional(),
    excludedCustomIds: vine.array(vine.number().withoutDecimals().positive()).optional(),
  })
)

const adjustment = vine.compile(vine.object({ kind: vine.enum(['burn', 'free'] as const) }))

/**
 * Running a fearless night: opening and closing it, leaving a game out, and
 * burning or freeing a champion by hand. Every answer is the board as it now
 * stands, so the page can show it without asking again.
 */
export default class FearlessController {
  async store({ params, request, response }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    const { label } = await startNight.validate(request.all())

    const service = new FearlessService()
    const night = await service.start(group, label ?? null)
    return response.created(await service.board(night))
  }

  async update({ params, request, response }: HttpContext) {
    const night = await FearlessNight.findOrFail(params.id)
    const patch = await nightPatch.validate(request.all())

    if (patch.label !== undefined) night.label = patch.label || null
    if (patch.ended && !night.endedAt) night.endedAt = DateTime.now()
    if (patch.excludedCustomIds !== undefined) {
      // Only the group's own customs: an id from elsewhere would be noise in the row.
      const own = await CustomGame.query()
        .where('group_id', night.groupId)
        .whereIn('id', patch.excludedCustomIds)
        .select('id')
      night.excludedCustomIds = own.map((game) => game.id).sort((a, b) => a - b)
    }
    await night.save()

    return response.ok(await new FearlessService().board(night))
  }

  async adjust({ params, request, response }: HttpContext) {
    const night = await FearlessNight.findOrFail(params.id)
    const { kind } = await adjustment.validate(request.all())

    const championId = Number(params.championId)
    const champion = Number.isInteger(championId) ? await StaticChampion.find(championId) : null
    if (!champion) return response.unprocessableEntity({ message: 'No champion with that id.' })

    // Changing one's mind restarts the clock a free is measured from.
    await FearlessAdjustment.updateOrCreate(
      { nightId: night.id, championId },
      { kind, decidedAt: DateTime.now() }
    )

    return response.ok(await new FearlessService().board(night))
  }

  async unadjust({ params, response }: HttpContext) {
    const night = await FearlessNight.findOrFail(params.id)
    await FearlessAdjustment.query()
      .where('night_id', night.id)
      .where('champion_id', Number(params.championId))
      .delete()

    return response.ok(await new FearlessService().board(night))
  }
}
