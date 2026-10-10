import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { readFile } from 'node:fs/promises'

import Match from '#models/match'
import MatchParticipant from '#models/match_participant'
import { MatchIngestService } from '#ingestion/match_ingest_service'
import type { MatchDto } from '#riot/types'

/** Real payloads captured from the live API, with player identifiers replaced. */
async function fixture(name: 'match_ranked_sr' | 'match_arena'): Promise<MatchDto> {
  const raw = await readFile(new URL(`../../fixtures/${name}.json`, import.meta.url), 'utf8')
  return JSON.parse(raw) as MatchDto
}

test.group('MatchIngestService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('ingests a ranked summoner\'s rift match', async ({ assert }) => {
    const match = await fixture('match_ranked_sr')
    const result = await new MatchIngestService().ingest(match)

    assert.equal(result.participants, 10)

    const stored = await Match.find(match.metadata.matchId)
    assert.equal(stored?.queueId, 420)
    assert.equal(stored?.queueGroup, 'ranked_solo')
    assert.equal(stored?.gameMode, 'CLASSIC')
    assert.equal(stored?.participantCount, 10)
    assert.isTrue(stored?.statsEligible)
  })

  /*
   * Co-op vs AI: Riot gives every bot the same puuid, "BOT" - five rows with
   * one key, which the upsert refused, stopping the whole backfill of anyone
   * who ever played against bots (EUW1_7892808370 was the real case).
   */
  test('stores a game against bots, five bots sharing one puuid', async ({ assert }) => {
    const match = await fixture('match_ranked_sr')
    const humans = match.info.participants.slice(0, 5)
    const bots = match.info.participants.slice(5).map((p) => ({ ...p, puuid: 'BOT' }))
    const coop = { ...match, info: { ...match.info, queueId: 890, participants: [...humans, ...bots] } }

    const result = await new MatchIngestService().ingest(coop)
    assert.equal(result.participants, 10)

    const stored = await MatchParticipant.query().where('match_id', match.metadata.matchId)
    assert.lengthOf(stored, 10)
    assert.lengthOf(new Set(stored.map((row) => row.puuid)), 10)
    // The humans keep their real puuid; only the bots are told apart.
    for (const human of humans) assert.include(stored.map((row) => row.puuid), human.puuid)

    // Fetched again, it lands on the same rows rather than adding five more.
    await new MatchIngestService().ingest(coop)
    assert.equal(
      (await MatchParticipant.query().where('match_id', match.metadata.matchId)).length,
      10
    )
  })

  test('stores a match Riot returned with no participants, and keeps the ones it has', async ({
    assert,
  }) => {
    const match = await fixture('match_ranked_sr')
    await new MatchIngestService().ingest(match)

    // The same match coming back empty: knex refuses an empty insert outright,
    // which was enough to abort a whole repair pass over one bad record.
    const empty = { ...match, info: { ...match.info, participants: [] } }
    const result = await new MatchIngestService().ingest(empty)

    assert.equal(result.participants, 0)

    const kept = await MatchParticipant.query().where('match_id', match.metadata.matchId)
    assert.lengthOf(kept, 10, 'an empty roster must not be read as everyone having left')
  })

  test('ingests an arena match, which has eighteen players and no lanes', async ({ assert }) => {
    const match = await fixture('match_arena')
    const result = await new MatchIngestService().ingest(match)

    assert.equal(result.participants, 18, 'Arena is not a ten-player mode')

    const stored = await Match.find(match.metadata.matchId)
    assert.equal(stored?.participantCount, 18)
    // Queue 1750 is absent from Riot's published list; gameMode carries it.
    assert.equal(stored?.queueGroup, 'arena')

    const participants = await MatchParticipant.query().where('match_id', match.metadata.matchId)
    assert.lengthOf(participants, 18)
    assert.isTrue(
      participants.every((p) => p.teamPosition === null),
      'an empty teamPosition must be stored as null, not as ""'
    )
    assert.isTrue(
      participants.every((p) => p.subteamId !== null),
      'every Arena player belongs to a subteam'
    )
  })

  test('stores all participants, not only the ones we track', async ({ assert }) => {
    const match = await fixture('match_ranked_sr')
    await new MatchIngestService().ingest(match)

    const participants = await MatchParticipant.query().where('match_id', match.metadata.matchId)
    assert.lengthOf(participants, 10)
    // Naming an opponent is what makes the live screen and matchup stats work.
    assert.isTrue(participants.every((p) => p.riotIdGameName !== null))
  })

  test('sums lane minions and jungle camps into cs', async ({ assert }) => {
    const match = await fixture('match_ranked_sr')
    await new MatchIngestService().ingest(match)

    const source = match.info.participants[0]
    const stored = await MatchParticipant.query()
      .where('match_id', match.metadata.matchId)
      .andWhere('puuid', source.puuid)
      .firstOrFail()

    assert.equal(stored.cs, source.totalMinionsKilled + source.neutralMinionsKilled)
  })

  test('keeps the raw payload so new stats need no re-fetch', async ({ assert }) => {
    const match = await fixture('match_ranked_sr')
    await new MatchIngestService().ingest(match)

    const stored = await Match.findOrFail(match.metadata.matchId)
    const raw = stored.raw as MatchDto
    assert.equal(raw.metadata.matchId, match.metadata.matchId)
    assert.lengthOf(raw.info.participants, 10)
  })

  test('is idempotent: two members syncing the same match store it once', async ({ assert }) => {
    const match = await fixture('match_ranked_sr')
    const service = new MatchIngestService()

    await service.ingest(match)
    await service.ingest(match)

    assert.lengthOf(await Match.all(), 1)
    assert.lengthOf(
      await MatchParticipant.query().where('match_id', match.metadata.matchId),
      10,
      're-ingesting must not duplicate participants'
    )
  })

  test('reads gameDuration as milliseconds when gameEndTimestamp is absent', async ({ assert }) => {
    const match = await fixture('match_ranked_sr')
    const seconds = match.info.gameDuration

    // Riot changed the unit in patch 11.20; older matches carry milliseconds and
    // no gameEndTimestamp. A backfill reaching far enough hits both.
    const legacy = structuredClone(match)
    legacy.metadata.matchId = 'EUW1_legacy'
    delete legacy.info.gameEndTimestamp
    legacy.info.gameDuration = seconds * 1000

    await new MatchIngestService().ingest(legacy)

    const stored = await Match.findOrFail('EUW1_legacy')
    assert.equal(stored.gameDuration, seconds, 'a 30 minute game must not become 30000 minutes')
    assert.isNull(stored.gameEndedAt)
  })

  test('ingests a batch in one transaction', async ({ assert }) => {
    const [sr, arena] = await Promise.all([fixture('match_ranked_sr'), fixture('match_arena')])

    const results = await new MatchIngestService().ingestMany([sr, arena])

    assert.lengthOf(results, 2)
    assert.lengthOf(await Match.all(), 2)
  })

  test('survives two syncs ingesting the same match at the same moment', async ({ assert }) => {
    const match = await fixture('match_ranked_sr')
    const service = new MatchIngestService()

    // What the recent-sync and backfill queues actually do when a group shares a
    // game: both list it, both find it missing, both write it.
    await Promise.all([service.ingest(match), service.ingest(match)])

    assert.lengthOf(await Match.all(), 1)
    assert.lengthOf(await MatchParticipant.query().where('match_id', match.metadata.matchId), 10)
  })

  test('drops a participant that a corrected payload no longer lists', async ({ assert }) => {
    const match = await fixture('match_ranked_sr')
    const service = new MatchIngestService()
    await service.ingest(match)

    const trimmed = structuredClone(match)
    const removed = trimmed.info.participants.pop()!
    trimmed.metadata.participants = trimmed.metadata.participants.filter(
      (puuid) => puuid !== removed.puuid
    )

    await service.ingest(trimmed)

    const remaining = await MatchParticipant.query().where('match_id', match.metadata.matchId)
    assert.lengthOf(remaining, 9)
    assert.notInclude(
      remaining.map((p) => p.puuid),
      removed.puuid
    )
  })

  test('accepts an empty batch without touching the database', async ({ assert }) => {
    assert.isEmpty(await new MatchIngestService().ingestMany([]))
  })
})
