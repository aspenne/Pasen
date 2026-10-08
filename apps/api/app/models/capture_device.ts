import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

import Group from '#models/group'

/** A PC linked to a group, allowed to upload captured customs and nothing else. */
export default class CaptureDevice extends BaseModel {
  static table = 'capture_devices'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare groupId: number

  @column()
  declare name: string

  /** SHA-256 of the token. The token itself is shown once and never stored. */
  @column({ serializeAs: null })
  declare tokenHash: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime()
  declare lastUsedAt: DateTime | null

  @column.dateTime()
  declare revokedAt: DateTime | null

  @belongsTo(() => Group)
  declare group: BelongsTo<typeof Group>
}
