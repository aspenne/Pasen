import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

import RiotAccount from '#models/riot_account'

/** A Riot ID an account used to go by, found by the daily check or typed in by the admin. */
export default class RiotAccountAlias extends BaseModel {
  static table = 'riot_account_aliases'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare riotAccountId: number

  @column()
  declare gameName: string

  @column()
  declare tagLine: string

  @column()
  declare source: 'riot' | 'manual'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => RiotAccount)
  declare account: BelongsTo<typeof RiotAccount>

  get riotId(): string {
    return `${this.gameName}#${this.tagLine}`
  }
}
