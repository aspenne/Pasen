import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class Setting extends BaseModel {
  static table = 'settings'

  @column({ isPrimary: true })
  declare key: string

  /**
   * The column is jsonb, so a bare string has to be JSON-encoded on the way in:
   * Postgres rejects `RGAPI-xyz` but accepts `"RGAPI-xyz"`. Reads come back
   * already parsed by pg, so `consume` only has to handle the write round-trip.
   */
  @column({
    prepare: (value: unknown) => JSON.stringify(value ?? null),
    consume: (value: unknown) => value,
  })
  declare value: unknown

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
