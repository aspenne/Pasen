import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { isStatsEligible, queueGroupFor } from '@pasen/shared'
import { DateTime } from 'luxon'

import Match from '#models/match'
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

    await Match.updateOrCreate(
      { matchId: metadata.matchId },
      {
        platform: info.platformId,
        queueId: info.queueId,
        queueGroup: queueGroupFor(info.queueId, info.gameMode),
        gameMode: info.gameMode,
        gameType: info.gameType,
        gameVersion: info.gameVersion,
        gameCreation,
        gameDuration: durationSeconds,
        gameEndedAt: info.gameEndTimestamp
          ? DateTime.fromMillis(info.gameEndTimestamp, { zone: 'utc' })
          : null,
        participantCount: info.participants.length,
        statsEligible: isStatsEligible(info.queueId, info.gameMode),
        raw: match,
        ingestedAt: DateTime.utc(),
      },
      { client: trx }
    )

    /*
     * Participants are replaced rather than upserted. A re-ingest is either
     * identical or a corrected payload, and a wholesale replace cannot leave a
     * stale row behind if Riot ever returns a different roster for a match id.
     */
    await trx.from('match_participants').where('match_id', metadata.matchId).delete()
    await trx
      .table('match_participants')
      .multiInsert(info.participants.map((p) => participantRow(metadata.matchId, p)))

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
