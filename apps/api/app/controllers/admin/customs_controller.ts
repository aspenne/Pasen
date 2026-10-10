import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'

import CustomGame from '#models/custom_game'
import Group from '#models/group'
import { CustomCaptureService, InvalidCaptureError } from '#customs/custom_capture_service'
import { CustomMatchMirror } from '#customs/custom_match_mirror'
import { stored } from '#customs/custom_game_reader'
import { viewCustomGame } from '#customs/custom_game_view'

/**
 * Uploading and listing captured customs.
 *
 * Behind the admin session like everything else that writes, and deliberately
 * not an open endpoint the agent can post to on its own: a token the agent
 * carries around on a gaming PC is a token that leaks, and one custom a week
 * does not justify it. The agent writes a file; a person uploads it.
 */
/**
 * `winner: null` hands the result back to the capture, so a wrong decision can
 * be undone without remembering what the capture said in the first place.
 */
const customPatch = vine.compile(
  vine.object({
    winner: vine.enum(['ORDER', 'CHAOS'] as const).nullable().optional(),
    label: vine.string().trim().maxLength(80).nullable().optional(),
  })
)

export default class CustomsController {
  async index({ params, response }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)

    const games = await CustomGame.query()
      .where('group_id', group.id)
      .orderBy('played_at', 'desc')
      .limit(100)

    /*
     * Who won needs no lookups - only the capture's GameEnd and the override -
     * so the list can flag the games nobody settled without resolving players.
     */
    const noLookups = { championIdBySlug: new Map(), spellIdBySlug: new Map(), memberByRiotId: new Map() }

    return response.ok(
      games.map((game) => {
        const view = viewCustomGame(stored(game), noLookups)
        return {
          id: game.id,
          label: game.label,
          playedAt: game.playedAt.toUTC().toISO(),
          duration: game.duration,
          gameMode: game.gameMode,
          mapName: game.mapName,
          playerCount: game.playerCount,
          resultKnown: view.resultKnown,
          resultSource: view.resultSource,
          winner: view.teams.find((team) => team.won)?.side ?? null,
          againstBots: view.againstBots,
        }
      })
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
       * Synced on a duplicate too: it is idempotent, and it means re-uploading
       * the file is how anyone repairs a game whose first mirror failed.
       */
      await new CustomMatchMirror().sync(game)

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

  async update({ params, request, response }: HttpContext) {
    const game = await CustomGame.findOrFail(params.id)
    const patch = await customPatch.validate(request.all())

    if (patch.winner !== undefined) game.winnerOverride = patch.winner
    if (patch.label !== undefined) game.label = patch.label || null
    await game.save()

    // A decided winner is what brings an unresolved inhouse into the match tables.
    await new CustomMatchMirror().sync(game)

    return response.ok({
      id: game.id,
      label: game.label,
      winnerOverride: game.winnerOverride,
    })
  }

  async destroy({ params, response }: HttpContext) {
    const game = await CustomGame.findOrFail(params.id)
    await new CustomMatchMirror().remove(game.id)
    await game.delete()
    return response.noContent()
  }
}
