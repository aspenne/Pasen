import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class StaticQueue extends BaseModel {
  static table = 'static_queues'
  static primaryKey = 'queueId'

  @column({ isPrimary: true })
  declare queueId: number

  @column()
  declare map: string | null

  @column()
  declare description: string | null

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
