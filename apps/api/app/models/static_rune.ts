import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

/** A rune or the style that contains one; a match payload names both by id. */
export default class StaticRune extends BaseModel {
  static table = 'static_runes'

  @column({ isPrimary: true })
  declare id: number

  /** 'style' for a tree, 'perk' for a rune inside it. */
  @column()
  declare kind: 'style' | 'perk'

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare image: string

  @column()
  declare version: string

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
