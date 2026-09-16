import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import type { QueueGroup } from '@pasen/shared'
import { DateTime } from 'luxon'

import MatchParticipant from '#models/match_participant'

export default class Match extends BaseModel {
  static table = 'matches'
  static primaryKey = 'matchId'
  // Riot supplies the id, so the database never generates one.
  static selfAssignPrimaryKey = true

  @column({ isPrimary: true })
  declare matchId: string

  @column()
  declare platform: string

  @column()
  declare queueId: number

  @column()
  declare queueGroup: QueueGroup

  @column()
  declare gameMode: string

  @column()
  declare gameType: string

  @column()
  declare gameVersion: string

  @column.dateTime()
  declare gameCreation: DateTime

  @column()
  declare gameDuration: number

  @column.dateTime()
  declare gameEndedAt: DateTime | null

  /** 10 on Summoner's Rift, 18 in Arena. Never assume. */
  @column()
  declare participantCount: number

  @column()
  declare statsEligible: boolean

  @column({
    prepare: (value: unknown) => JSON.stringify(value),
    consume: (value: unknown) => value,
  })
  declare raw: unknown

  @column.dateTime()
  declare ingestedAt: DateTime

  @hasMany(() => MatchParticipant, { foreignKey: 'matchId', localKey: 'matchId' })
  declare participants: HasMany<typeof MatchParticipant>
}
