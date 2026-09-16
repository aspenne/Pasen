import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class StaticItem extends BaseModel {
  static table = 'static_items'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare plaintext: string | null

  @column()
  declare goldTotal: number

  @column()
  declare image: string

  @column()
  declare version: string

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
