import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

import FearlessAdjustment from '#models/fearless_adjustment'
import Group from '#models/group'

/** One evening of fearless customs, as the admin opened it. */
export default class FearlessNight extends BaseModel {
  static table = 'fearless_nights'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare groupId: number

  @column()
  declare label: string | null

  @column.dateTime()
  declare startedAt: DateTime

  /** Null until someone presses End; the night still closes six hours in. */
  @column.dateTime()
  declare endedAt: DateTime | null

  /** Customs left out of this night without being deleted from the site. */
  @column({
    prepare: (value: unknown) => JSON.stringify(value ?? []),
    consume: (value: unknown) => value,
  })
  declare excludedCustomIds: number[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => Group)
  declare group: BelongsTo<typeof Group>

  @hasMany(() => FearlessAdjustment, { foreignKey: 'nightId' })
  declare adjustments: HasMany<typeof FearlessAdjustment>
}
