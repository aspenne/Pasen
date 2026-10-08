import type { HttpContext } from '@adonisjs/core/http'

import CaptureDevice from '#models/capture_device'
import { CaptureDeviceService } from '#customs/capture_device_service'
import { CustomCaptureService, InvalidCaptureError } from '#customs/custom_capture_service'
import { CustomMatchMirror } from '#customs/custom_match_mirror'

/**
 * What the desktop capture app talks to, with the token it was paired with.
 *
 * Two routes and no more: one to check the pairing still holds, one to send a
 * game. Everything else on the site stays behind the admin session.
 */
export default class CaptureController {
  async whoami(ctx: HttpContext) {
    const device = await this.#device(ctx)
    if (!device) return

    return ctx.response.ok({
      device: { name: device.name },
      group: { slug: device.group.slug, name: device.group.name },
    })
  }

  async store(ctx: HttpContext) {
    const device = await this.#device(ctx)
    if (!device) return

    const { request, response } = ctx
    try {
      const { game, duplicate } = await new CustomCaptureService().store(
        device.group,
        request.input('capture'),
        {
          fileName: request.input('fileName'),
          capturedAt: request.input('capturedAt'),
          label: request.input('label'),
        }
      )
      await new CustomMatchMirror().sync(game)

      return response.status(duplicate ? 200 : 201).json({
        id: game.id,
        duplicate,
        url: `/${device.group.slug}/customs/${game.id}`,
        gameMode: game.gameMode,
        playerCount: game.playerCount,
      })
    } catch (error) {
      if (error instanceof InvalidCaptureError) {
        return response.unprocessableEntity({ message: error.message })
      }
      throw error
    }
  }

  /** Answers 401 itself when the token is missing, wrong or revoked. */
  async #device({ request, response }: HttpContext): Promise<CaptureDevice | null> {
    const header = request.header('authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null
    const device = await new CaptureDeviceService().resolve(token)

    if (!device) {
      response.unauthorized({
        message: 'This PC is not linked, or its link was revoked. Pair it again from the admin.',
      })
      return null
    }
    return device
  }
}
