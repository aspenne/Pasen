import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { isStatsEligible, queueGroupFor } from '@pasen/shared'
import { DateTime } from 'luxon'

import type { MatchDto, MatchParticipantDto } from '#riot/types'

export type IngestResult = {
  matchId: string
  participants: number
  gameCreation: DateTime
}

/**
 * Turns a match-v5 payload into rows. Pure mapping plus one upsert, with no
 * knowledge of who asked for the match or why, so a backfill and a live-game
 * follow-up both land the same data.
 *
 * Ingesting the same match twice is a no-op by design: several members of a
 * group share matches, and each of their syncs will find the same ids.
 */
export class MatchIngestService {
  async ingest(match: MatchDto, trx?: TransactionClientContract): Promise<IngestResult> {
    if (trx) {
      return this.#write(match, trx)
    }
    return db.transaction((client) => this.#write(match, client))
  }

  /** Ingests a batch in one transaction: a half-written page is worse than none. */
  async ingestMany(matches: MatchDto[]): Promise<IngestResult[]> {
    if (matches.length === 0) {
      return []
    }

    return db.transaction(async (client) => {
      const results: IngestResult[] = []
      for (const match of matches) {
        results.push(await this.#write(match, client))
      }
      return results
    })
  }

  async #write(match: MatchDto, trx: TransactionClientContract): Promise<IngestResult> {
    const { info, metadata } = match
    const gameCreation = DateTime.fromMillis(info.gameCreation, { zone: 'utc' })
    const durationSeconds = durationSecondsOf(info)

    /*
     * A real upsert, not updateOrCreate. That does a SELECT then an INSERT, and
     * the two are not atomic: with a group sharing games, the recent-sync and
     * backfill queues reach the same match at the same moment, both find nothing,
     * and the second insert dies on the primary key.
     *
     * Lucid's insert builder has no onConflict, so this drops to its knex query.
     */
    await trx
      .insertQuery()
      .table('matches')
      .knexQuery.insert({
        match_id: metadata.matchId,
        platform: info.platformId,
        queue_id: info.queueId,
        queue_group: queueGroupFor(info.queueId, info.gameMode),
        game_mode: info.gameMode,
        game_type: info.gameType,
        game_version: info.gameVersion,
        game_creation: gameCreation.toISO()!,
        game_duration: durationSeconds,
        game_ended_at: info.gameEndTimestamp
          ? DateTime.fromMillis(info.gameEndTimestamp, { zone: 'utc' }).toISO()
          : null,
        participant_count: info.participants.length,
        stats_eligible: isStatsEligible(info.queueId, info.gameMode),
        raw: JSON.stringify(match),
        ingested_at: DateTime.utc().toISO()!,
      })
      .onConflict('match_id')
      .merge()

    /*
     * Upserted rather than deleted-then-inserted. Two concurrent ingests of the
     * same match both delete nothing (there is nothing to lock), then both
     * insert, and one dies on the composite key.
     */
    const rows = info.participants.map((p) => participantRow(metadata.matchId, p))

    await trx
      .insertQuery()
      .table('match_participants')
      .knexQuery.insert(rows)
      .onConflict(['match_id', 'puuid'])
      .merge()

    // Anything no longer in the payload. Riot does not change a match's roster,
    // so this normally deletes nothing - it exists so a corrected payload cannot
    // leave a stale player behind.
    await trx
      .from('match_participants')
      .where('match_id', metadata.matchId)
      .whereNotIn(
        'puuid',
        rows.map((row) => row.puuid)
      )
      .delete()

    return {
      matchId: metadata.matchId,
      participants: info.participants.length,
      gameCreation,
    }
  }
}

/**
 * Riot changed the unit of gameDuration in patch 11.20: it is seconds for
 * matches that carry gameEndTimestamp and milliseconds for older ones. A
 * backfill reaching back far enough hits both, and getting it wrong turns a
 * 30-minute game into a 30,000-minute one.
 */
function durationSecondsOf(info: MatchDto['info']): number {
  return info.gameEndTimestamp === undefined
    ? Math.round(info.gameDuration / 1000)
    : info.gameDuration
}

function participantRow(matchId: string, p: MatchParticipantDto) {
  return {
    match_id: matchId,
    puuid: p.puuid,
    team_id: p.teamId,
    // Arena only. 0 means "not an Arena match", which is not a subteam.
    subteam_id: p.playerSubteamId || null,
    subteam_placement: p.subteamPlacement || null,
    champion_id: p.championId,
    champion_name: p.championName,
    // Riot sends an empty string outside Summoner's Rift; null says "no lane"
    // rather than inventing a position that does not exist in the mode.
    team_position: p.teamPosition || null,
    individual_position: p.individualPosition || null,
    win: p.win,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    gold_earned: p.goldEarned,
    cs: (p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0),
    damage_dealt: p.totalDamageDealtToChampions,
    damage_taken: p.totalDamageTaken,
    vision_score: p.visionScore,
    wards_placed: p.wardsPlaced,
    wards_killed: p.wardsKilled,
    champ_level: p.champLevel,
    summoner1_id: p.summoner1Id,
    summoner2_id: p.summoner2Id,
    items: JSON.stringify([p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6]),
    perks: p.perks === undefined ? null : JSON.stringify(p.perks),
    riot_id_game_name: p.riotIdGameName ?? null,
    riot_id_tag_line: p.riotIdTagline ?? null,
    double_kills: p.doubleKills ?? 0,
    triple_kills: p.tripleKills ?? 0,
    quadra_kills: p.quadraKills ?? 0,
    penta_kills: p.pentaKills ?? 0,
    first_blood_kill: p.firstBloodKill ?? false,
    early_surrender: p.gameEndedInEarlySurrender ?? false,
  }
}
