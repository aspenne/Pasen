import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

import RoleDraw from '#models/role_draw'
import type { Teams } from '#roulette/lobby_teams'

/** Who is on which side of a custom about to start, as the client or the admin said. */
export default class CustomLobby extends BaseModel {
  static table = 'custom_lobbies'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare groupId: number

  @column({
    prepare: (value: unknown) => JSON.stringify(value),
    consume: (value: unknown) => value,
  })
  declare teams: Teams

  @column()
  declare source: 'capture' | 'manual'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  /** Touched every time the capture app sees the same lobby again. */
  @column.dateTime({ autoCreate: true })
  declare updatedAt: DateTime

  @hasMany(() => RoleDraw, { foreignKey: 'lobbyId' })
  declare draws: HasMany<typeof RoleDraw>
}
