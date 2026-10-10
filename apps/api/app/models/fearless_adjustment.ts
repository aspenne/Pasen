import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

/** The admin burning a champion by hand, or giving one back. One per champion per night. */
export default class FearlessAdjustment extends BaseModel {
  static table = 'fearless_adjustments'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare nightId: number

  @column()
  declare championId: number

  @column()
  declare kind: 'burn' | 'free'

  /** When the admin decided: a free only forgives the games that ended before it. */
  @column.dateTime()
  declare decidedAt: DateTime
}
