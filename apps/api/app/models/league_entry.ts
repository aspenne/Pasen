import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

import RiotAccount from '#models/riot_account'

/** One point on an account's rank curve. Append-only. */
export default class LeagueEntry extends BaseModel {
  static table = 'league_entries'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare riotAccountId: number

  @column()
  declare queueType: string

  @column()
  declare tier: string | null

  @column()
  declare rank: string | null

  @column()
  declare leaguePoints: number

  @column()
  declare wins: number

  @column()
  declare losses: number

  @column()
  declare hotStreak: boolean

  @column.dateTime()
  declare capturedAt: DateTime

  @belongsTo(() => RiotAccount)
  declare riotAccount: BelongsTo<typeof RiotAccount>
}
