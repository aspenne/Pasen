import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

import type { RoleDraw as Roles } from '#roulette/draw_roles'

/** One deal of the roles on a lobby, and the moment every page starts showing it. */
export default class RoleDraw extends BaseModel {
  static table = 'role_draws'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare lobbyId: number

  @column({
    prepare: (value: unknown) => JSON.stringify(value),
    consume: (value: unknown) => value,
  })
  declare roles: Roles

  @column.dateTime()
  declare revealAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
