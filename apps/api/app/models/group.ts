import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

import Member from '#models/member'

export default class Group extends BaseModel {
  static table = 'groups'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare slug: string

  @column()
  declare name: string

  @column()
  declare timezone: string

  @manyToMany(() => Member, {
    pivotTable: 'group_members',
    pivotColumns: ['role'],
    pivotTimestamps: true,
  })
  declare members: ManyToMany<typeof Member>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
