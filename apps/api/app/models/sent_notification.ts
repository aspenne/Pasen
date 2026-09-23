import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

/** Something already announced. Its presence is what stops a second attempt. */
export default class SentNotification extends BaseModel {
  static table = 'sent_notifications'
  static primaryKey = 'key'
  static selfAssignPrimaryKey = true

  @column({ isPrimary: true })
  declare key: string

  @column()
  declare kind: string

  @column.dateTime()
  declare sentAt: DateTime
}
