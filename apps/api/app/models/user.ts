import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'

import Member from '#models/member'

export const USER_ROLES = ['member', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare fullName: string | null

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  /** A member can sign in; only an admin reaches the admin routes. */
  @column()
  declare role: UserRole

  /** The player this account belongs to, once an admin has said so. */
  @column()
  declare memberId: number | null

  @belongsTo(() => Member)
  declare member: BelongsTo<typeof Member>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
