import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import Group from '#models/group'
import Member from '#models/member'
import RiotAccount from '#models/riot_account'
import { PuuidRekeyService } from '#ingestion/puuid_rekey_service'
import { RiotClient } from '#riot/client'
import type { RiotRequest, RiotRequester } from '#riot/gateway'

/** Answers account-v1 from a Riot ID to puuid lookup; everything else throws. */
function fakeRiot(resolve: Record<string, string>) {
  const requester: RiotRequester = {
    async request<T>(request: RiotRequest): Promise<T> {
      if (request.endpoint !== 'account-v1.byRiotId') {
        throw new Error(`unexpected call to ${request.endpoint}`)
      }

      const [gameName, tagLine] = request.path.split('/').slice(-2).map(decodeURIComponent)
      const puuid = resolve[`${gameName}#${tagLine}`]
      if (!puuid) throw new Error('not found')

      return { puuid, gameName, tagLine } as T
    },
  }

  return new RiotClient(requester)
}

async function seedAccount(riotId: string, puuid: string) {
  const [gameName, tagLine] = riotId.split('#')
  const group = await Group.firstOrCreate({ slug: 'arigafion' }, { name: 'ARIGAFION' })
  const member = await Member.create({ slug: gameName.toLowerCase(), displayName: gameName })
  await group.related('members').attach([member.id])

  return RiotAccount.create({
    memberId: member.id,
    puuid,
    gameName,
    tagLine,
    platform: 'euw1',
    backfillState: 'done',
  })
}

/** A match with our member on it, plus an opponent who is not tracked. */
async function seedMatch(matchId: string, ourPuuid: string, theirPuuid: string) {
  await db.table('matches').insert({
    match_id: matchId,
    platform: 'EUW1',
    queue_id: 420,
    queue_group: 'ranked_solo',
    game_version: '26.18.1',
    stats_eligible: true,
    game_mode: 'CLASSIC',
    game_type: 'MATCHED_GAME',
    game_creation: DateTime.utc().toSQL(),
    game_duration: 1800,
    participant_count: 2,
    raw: JSON.stringify({}),
    ingested_at: DateTime.utc().toSQL(),
  })

  await db.table('match_participants').insert(
    [ourPuuid, theirPuuid].map((puuid, index) => ({
      match_id: matchId,
      puuid,
      team_id: index === 0 ? 100 : 200,
      champion_id: 1 + index,
      champion_name: 'Annie',
      win: index === 0,
      kills: 1,
      deaths: 2,
      assists: 3,
      gold_earned: 1000,
      cs: 100,
      damage_dealt: 1000,
      damage_taken: 1000,
      vision_score: 10,
      wards_placed: 1,
      wards_killed: 1,
      champ_level: 15,
      summoner1_id: 4,
      summoner2_id: 12,
      items: JSON.stringify([]),
      double_kills: 0,
      triple_kills: 0,
      quadra_kills: 0,
      penta_kills: 0,
      first_blood_kill: false,
    }))
  )
}

test.group('PuuidRekeyService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('moves a member history onto the puuid their new key returns', async ({ assert }) => {
    const account = await seedAccount('froslass#216', 'old-puuid')
    await seedMatch('EUW1_1', 'old-puuid', 'stranger-puuid')

    const report = await new PuuidRekeyService(fakeRiot({ 'froslass#216': 'new-puuid' })).rekey()

    assert.lengthOf(report.rekeyed, 1)
    assert.equal(report.rekeyed[0].participations, 1)

    await account.refresh()
    assert.equal(account.puuid, 'new-puuid')

    const ours = await db.from('match_participants').where('puuid', 'new-puuid').count('* as n').first()
    assert.equal(Number(ours?.n), 1, 'the match must follow the account')

    const stale = await db.from('match_participants').where('puuid', 'old-puuid').count('* as n').first()
    assert.equal(Number(stale?.n), 0, 'nothing may still point at the old identifier')
  })

  test('leaves the other participants of a match alone', async ({ assert }) => {
    await seedAccount('froslass#216', 'old-puuid')
    await seedMatch('EUW1_1', 'old-puuid', 'stranger-puuid')

    await new PuuidRekeyService(fakeRiot({ 'froslass#216': 'new-puuid' })).rekey()

    const stranger = await db
      .from('match_participants')
      .where('puuid', 'stranger-puuid')
      .count('* as n')
      .first()

    // We never call Riot with theirs, so re-keying it would be meaningless.
    assert.equal(Number(stranger?.n), 1)
  })

  test('touches nothing when the puuid still resolves to what we hold', async ({ assert }) => {
    await seedAccount('froslass#216', 'same-puuid')
    await seedMatch('EUW1_1', 'same-puuid', 'stranger-puuid')

    const report = await new PuuidRekeyService(fakeRiot({ 'froslass#216': 'same-puuid' })).rekey()

    assert.lengthOf(report.rekeyed, 0)
    assert.equal(report.checked, 1)
  })

  test('reports an account it cannot resolve without stranding the others', async ({ assert }) => {
    await seedAccount('froslass#216', 'old-a')
    await seedAccount('gone#XXX', 'old-b')
    await seedMatch('EUW1_1', 'old-a', 'stranger-puuid')

    const report = await new PuuidRekeyService(fakeRiot({ 'froslass#216': 'new-a' })).rekey()

    assert.deepEqual(report.unresolved, ['gone#XXX'])
    assert.lengthOf(report.rekeyed, 1, 'the resolvable account still moved')
  })
})
