import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import type { Platform } from '@pasen/shared'
import { DateTime } from 'luxon'

import LeagueEntry from '#models/league_entry'
import Member from '#models/member'

export const BACKFILL_STATES = ['pending', 'running', 'done', 'failed'] as const
export type BackfillState = (typeof BACKFILL_STATES)[number]

export default class RiotAccount extends BaseModel {
  static table = 'riot_accounts'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare memberId: number

  @column()
  declare puuid: string

  @column()
  declare gameName: string

  @column()
  declare tagLine: string

  @column()
  declare platform: Platform

  @column()
  declare profileIconId: number | null

  @column()
  declare summonerLevel: number | null

  /** Newest match ingested; incremental sync asks Riot for anything after it. */
  @column.dateTime()
  declare syncedTo: DateTime | null

  /** Oldest match ingested; the backfill walks this backwards. */
  @column.dateTime()
  declare syncedFrom: DateTime | null

  @column.dateTime()
  declare backfillTarget: DateTime | null

  @column()
  declare backfillState: BackfillState

  @column()
  declare backfillError: string | null

  @column.dateTime()
  declare lastSyncedAt: DateTime | null

  @column.dateTime()
  declare lastSeenLiveAt: DateTime | null

  @belongsTo(() => Member)
  declare member: BelongsTo<typeof Member>

  @hasMany(() => LeagueEntry)
  declare leagueEntries: HasMany<typeof LeagueEntry>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  get riotId() {
    return `${this.gameName}#${this.tagLine}`
  }
}
