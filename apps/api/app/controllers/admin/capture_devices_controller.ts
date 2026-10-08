import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'

import CaptureDevice from '#models/capture_device'
import Group from '#models/group'
import { CaptureDeviceService } from '#customs/capture_device_service'

const newDevice = vine.compile(
  vine.object({ name: vine.string().trim().minLength(1).maxLength(60) })
)

/** Pairing and revoking the PCs that run the capture app. Behind the admin session. */
export default class CaptureDevicesController {
  async index({ params, response }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    const devices = await CaptureDevice.query().where('group_id', group.id).orderBy('created_at', 'desc')

    return response.ok(
      devices.map((device) => ({
        id: device.id,
        name: device.name,
        createdAt: device.createdAt.toUTC().toISO(),
        lastUsedAt: device.lastUsedAt?.toUTC().toISO() ?? null,
        revokedAt: device.revokedAt?.toUTC().toISO() ?? null,
      }))
    )
  }

  /**
   * The only response that ever carries the token. It is not stored, so it
   * cannot be shown again - a lost one is replaced by pairing again.
   */
  async store({ params, request, response }: HttpContext) {
    const group = await Group.findByOrFail('slug', params.slug)
    const { name } = await newDevice.validate(request.all())
    const { device, token } = await new CaptureDeviceService().pair(group, name)

    return response.created({ id: device.id, name: device.name, token })
  }

  async destroy({ params, response }: HttpContext) {
    const device = await CaptureDevice.findOrFail(params.id)
    await new CaptureDeviceService().revoke(device)
    return response.noContent()
  }
}
