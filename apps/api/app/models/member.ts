import { BaseModel, column, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

import Group from '#models/group'
import RiotAccount from '#models/riot_account'

export default class Member extends BaseModel {
  static table = 'members'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare slug: string

  @column()
  declare displayName: string

  @column()
  declare avatarUrl: string | null

  @column()
  declare accentColor: string | null

  /** A person's smurfs. Stats aggregate across all of them. */
  @hasMany(() => RiotAccount)
  declare riotAccounts: HasMany<typeof RiotAccount>

  @manyToMany(() => Group, {
    pivotTable: 'group_members',
    pivotColumns: ['role'],
    pivotTimestamps: true,
  })
  declare groups: ManyToMany<typeof Group>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
