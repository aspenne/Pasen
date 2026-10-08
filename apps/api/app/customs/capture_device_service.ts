import { createHash, randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'

import CaptureDevice from '#models/capture_device'
import Group from '#models/group'

/**
 * Pairing a PC with a group, and recognising it afterwards.
 *
 * The token is 32 random bytes, shown once at pairing and stored only as a
 * hash - a leaked database does not leak a working token. It is scoped by
 * construction: the only route that accepts it uploads a custom to the group
 * it was issued for, so a stolen one can add a game and nothing more, and one
 * click in the admin ends it.
 */
const PREFIX = 'pasen_'

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export class CaptureDeviceService {
  async pair(group: Group, name: string): Promise<{ device: CaptureDevice; token: string }> {
    const token = `${PREFIX}${randomBytes(32).toString('base64url')}`
    const device = await CaptureDevice.create({
      groupId: group.id,
      name: name.trim(),
      tokenHash: hashToken(token),
    })
    return { device, token }
  }

  /** The live device behind a bearer token, or null - never a revoked one. */
  async resolve(token: string | undefined | null): Promise<CaptureDevice | null> {
    if (!token || !token.startsWith(PREFIX)) return null

    const device = await CaptureDevice.query()
      .where('token_hash', hashToken(token))
      .whereNull('revoked_at')
      .preload('group')
      .first()
    if (!device) return null

    device.lastUsedAt = DateTime.utc()
    await device.save()
    return device
  }

  async revoke(device: CaptureDevice): Promise<void> {
    if (device.revokedAt) return
    device.revokedAt = DateTime.utc()
    await device.save()
  }
}
