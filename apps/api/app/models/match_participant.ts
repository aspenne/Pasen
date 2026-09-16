import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import Match from '#models/match'

/**
 * One player in one match, stored for all participants and not just tracked
 * members.
 *
 * The real primary key is (match_id, puuid), and Lucid has no composite key
 * support. `primaryKey` below is therefore a placeholder with teeth: find() will
 * return an arbitrary participant, and save() on a loaded row issues
 * `UPDATE ... WHERE match_id = ?`, rewriting every player in that match.
 *
 * So treat this model as read-only and always query it by both columns. Writes
 * go through the query builder in bulk - see MatchIngestService.
 */
export default class MatchParticipant extends BaseModel {
  static table = 'match_participants'
  static primaryKey = 'matchId'
  static selfAssignPrimaryKey = true

  @column({ isPrimary: true })
  declare matchId: string

  @column()
  declare puuid: string

  @column()
  declare teamId: number

  @column()
  declare subteamId: number | null

  @column()
  declare subteamPlacement: number | null

  @column()
  declare championId: number

  @column()
  declare championName: string

  @column()
  declare teamPosition: string | null

  @column()
  declare individualPosition: string | null

  @column()
  declare win: boolean

  @column()
  declare kills: number

  @column()
  declare deaths: number

  @column()
  declare assists: number

  @column()
  declare goldEarned: number

  @column()
  declare cs: number

  @column()
  declare damageDealt: number

  @column()
  declare damageTaken: number

  @column()
  declare visionScore: number

  @column()
  declare wardsPlaced: number

  @column()
  declare wardsKilled: number

  @column()
  declare champLevel: number

  /*
   * Lucid's naming strategy splits on the digit and produces summoner_1_id,
   * which is not the column. Spelled out so a read through the model does not
   * silently come back undefined.
   */
  @column({ columnName: 'summoner1_id' })
  declare summoner1Id: number

  @column({ columnName: 'summoner2_id' })
  declare summoner2Id: number

  @column({
    prepare: (value: unknown) => JSON.stringify(value ?? []),
    consume: (value: unknown) => value,
  })
  declare items: number[]

  @column({
    prepare: (value: unknown) => (value === null || value === undefined ? null : JSON.stringify(value)),
    consume: (value: unknown) => value,
  })
  declare perks: unknown

  @column()
  declare riotIdGameName: string | null

  @column()
  declare riotIdTagLine: string | null

  @column()
  declare doubleKills: number

  @column()
  declare tripleKills: number

  @column()
  declare quadraKills: number

  @column()
  declare pentaKills: number

  @column()
  declare firstBloodKill: boolean

  @column()
  declare earlySurrender: boolean

  @belongsTo(() => Match, { foreignKey: 'matchId', localKey: 'matchId' })
  declare match: BelongsTo<typeof Match>
}
