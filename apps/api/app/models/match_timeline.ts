import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

/** Populated only when RIOT_FETCH_TIMELINES is on: it doubles the cost per match. */
export default class MatchTimeline extends BaseModel {
  static table = 'match_timelines'
  static primaryKey = 'matchId'
  static selfAssignPrimaryKey = true

  @column({ isPrimary: true })
  declare matchId: string

  @column({
    prepare: (value: unknown) => JSON.stringify(value),
    consume: (value: unknown) => value,
  })
  declare raw: unknown

  @column.dateTime()
  declare fetchedAt: DateTime
}
