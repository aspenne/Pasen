import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

import Group from '#models/group'

/**
 * One captured custom game. The only table here whose rows cannot be rebuilt
 * from Riot, so `raw` holds the capture untouched and everything else is
 * derived from it.
 */
export default class CustomGame extends BaseModel {
  static table = 'custom_games'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare groupId: number

  /** SHA-256 of the capture, which is the only identity the payload carries. */
  @column()
  declare fingerprint: string

  @column.dateTime()
  declare playedAt: DateTime

  /** Seconds of game clock at the moment of capture. */
  @column()
  declare duration: number

  @column()
  declare gameMode: string

  @column()
  declare mapName: string | null

  @column()
  declare playerCount: number

  /** Whatever whoever uploaded it wants to call the game. */
  @column()
  declare label: string | null

  /**
   * The winning side as decided by a person, which beats whatever the capture
   * implies. Null means "go by the capture".
   */
  @column()
  declare winnerOverride: 'ORDER' | 'CHAOS' | null

  @column()
  declare raw: Record<string, unknown>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => Group)
  declare group: BelongsTo<typeof Group>
}
