import type { HttpContext } from '@adonisjs/core/http'

import CustomGame from '#models/custom_game'
import Group from '#models/group'
import { CustomCaptureService, InvalidCaptureError } from '#customs/custom_capture_service'

/**
 * Uploading and listing captured customs.
 *
 * Behind the admin session like everything else that writes, and deliberately
 * not an open endpoint the agent can post to on its own: a token the agent
 * carries around on a gaming PC is a token that leaks, and one custom a week
 * does not justify it. The agent writes a file; a person uploads it.
 */
export default class CustomsController {
  async index({ params, response }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)

    const games = await CustomGame.query()
      .where('group_id', group.id)
      .orderBy('played_at', 'desc')
      .limit(100)

    return response.ok(
      games.map((game) => ({
        id: game.id,
        label: game.label,
        playedAt: game.playedAt.toUTC().toISO(),
        duration: game.duration,
        gameMode: game.gameMode,
        mapName: game.mapName,
        playerCount: game.playerCount,
      }))
    )
  }

  async store({ params, request, response }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)

    const capture = request.input('capture')
    const fileName = request.input('fileName')
    const capturedAt = request.input('capturedAt')
    const label = request.input('label')

    try {
      const { game, duplicate } = await new CustomCaptureService().store(group, capture, {
        fileName,
        capturedAt,
        label,
      })

      /*
       * A duplicate is not an error - someone re-uploading the same file is
       * being careful, not wrong - so it answers 200 with what is already
       * stored rather than 409 with nothing.
       */
      return response.status(duplicate ? 200 : 201).json({
        id: game.id,
        duplicate,
        label: game.label,
        playedAt: game.playedAt.toUTC().toISO(),
        duration: game.duration,
        gameMode: game.gameMode,
        mapName: game.mapName,
        playerCount: game.playerCount,
      })
    } catch (error) {
      if (error instanceof InvalidCaptureError) {
        return response.unprocessableEntity({ message: error.message })
      }
      throw error
    }
  }

  async destroy({ params, response }: HttpContext) {
    const game = await CustomGame.findOrFail(params.id)
    await game.delete()
    return response.noContent()
  }
}
