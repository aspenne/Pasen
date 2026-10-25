import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { DraftKind, DraftRole, DraftSide } from '@pasen/shared'
import { DateTime } from 'luxon'

/** One ban or pick, at one step of a draft. */
export default class DraftActionRow extends BaseModel {
  static table = 'draft_actions'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare draftId: number

  @column()
  declare step: number

  @column()
  declare side: DraftSide

  @column()
  declare kind: DraftKind

  @column()
  declare championId: number

  @column()
  declare role: DraftRole | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
