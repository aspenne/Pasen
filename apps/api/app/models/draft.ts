import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

import DraftActionRow from '#models/draft_action'

/** A champion select: two captains banning and picking in tournament order. */
export default class Draft extends BaseModel {
  static table = 'drafts'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare groupId: number

  @column()
  declare fearlessNightId: number | null

  @column({ serializeAs: null })
  declare blueSeat: string | null

  @column({ serializeAs: null })
  declare redSeat: string | null

  /** What the captain on the clock is looking at, for everyone watching. */
  @column()
  declare hoverChampionId: number | null

  @column.dateTime()
  declare stepStartedAt: DateTime

  @column.dateTime()
  declare finishedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @hasMany(() => DraftActionRow, { foreignKey: 'draftId' })
  declare actions: HasMany<typeof DraftActionRow>
}
