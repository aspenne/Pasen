import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class StaticChampion extends BaseModel {
  static table = 'static_champions'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare slug: string

  @column()
  declare name: string

  @column()
  declare title: string

  @column({
    prepare: (value: unknown) => JSON.stringify(value ?? []),
    consume: (value: unknown) => value,
  })
  declare tags: string[]

  /** Lanes the champion is played in: TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY. */
  @column({
    prepare: (value: unknown) => JSON.stringify(value ?? []),
    consume: (value: unknown) => value,
  })
  declare positions: string[]

  @column()
  declare image: string

  @column()
  declare version: string

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
