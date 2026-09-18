import { test } from '@japa/runner'
import redis from '@adonisjs/redis/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'

import Member from '#models/member'
import RiotAccount from '#models/riot_account'
import { addParticipant, seedGroup, seedMatch } from '#tests/helpers'

test.group('Group API', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(async () => {
    await redis.del('live:games')
  })

  test('answers 404 for a group that does not exist', async ({ client }) => {
    const response = await client.get('/api/groups/nope')
    response.assertStatus(404)
  })

  test('returns the roster with accounts and current rank', async ({ client, assert }) => {
    await seedGroup()

    const response = await client.get('/api/groups/arigafion')

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.name, 'ARIGAFION')
    assert.lengthOf(body.members, 1)
    assert.equal(body.members[0].accounts[0].riotId, 'Patate#CCC')
  })

  test('counts a late-night game as part of the evening it belongs to', async ({
    client,
    assert,
  }) => {
    const seeded = await seedGroup('Europe/Paris')
    // 00:30 in Paris on the 16th is 22:30 UTC on the 15th. Asking UTC would file
    // it under the 15th, which is not the day the group thinks they played it.
    const lateNight = DateTime.fromISO('2026-09-16T00:30:00', { zone: 'Europe/Paris' })
    await seedMatch('EUW1_late', lateNight, seeded.account.puuid)

    const sixteenth = await client.get('/api/groups/arigafion/feed?date=2026-09-16')
    assert.equal(sixteenth.body().totals.games, 1)

    const fifteenth = await client.get('/api/groups/arigafion/feed?date=2026-09-15')
    assert.equal(fifteenth.body().totals.games, 0)
  })

  test('groups a five-stack into one card', async ({ client, assert }) => {
    const seeded = await seedGroup()
    const second = await Member.create({ slug: 'nono', displayName: 'Nono' })
    await seeded.group.related('members').attach([second.id])
    await RiotAccount.create({
      memberId: second.id,
      puuid: 'puuid-nono',
      gameName: 'Nono',
      tagLine: 'EUW',
      platform: 'euw1',
      backfillState: 'done',
    })

    const at = DateTime.fromISO('2026-09-16T20:00:00', { zone: 'Europe/Paris' })
    const match = await seedMatch('EUW1_duo', at, seeded.account.puuid)
    await addParticipant(match, 'puuid-nono', {
      championId: 103,
      championName: 'Ahri',
      teamPosition: 'MIDDLE',
    })

    const response = await client.get('/api/groups/arigafion/feed?date=2026-09-16')
    const body = response.body()

    assert.equal(body.totals.games, 1, 'one match, however many of us were in it')
    assert.equal(body.totals.memberGames, 2)
    assert.lengthOf(body.matches[0].members, 2)
  })

  test('filters the feed by queue', async ({ client, assert }) => {
    const seeded = await seedGroup()
    const at = DateTime.fromISO('2026-09-16T20:00:00', { zone: 'Europe/Paris' })
    await seedMatch('EUW1_ranked', at, seeded.account.puuid)
    await seedMatch('EUW1_aram', at, seeded.account.puuid, {
      queueId: 450,
      queueGroup: 'aram',
      gameMode: 'ARAM',
    })

    const response = await client.get('/api/groups/arigafion/feed?date=2026-09-16&scope=aram')

    assert.equal(response.body().totals.games, 1)
    assert.equal(response.body().matches[0].queueGroup, 'aram')
  })

  test('leaves ARAM and Arena out of the default view', async ({ client, assert }) => {
    const seeded = await seedGroup()
    const at = DateTime.fromISO('2026-09-16T20:00:00', { zone: 'Europe/Paris' })
    await seedMatch('EUW1_ranked', at, seeded.account.puuid)
    await seedMatch('EUW1_aram', at, seeded.account.puuid, {
      queueId: 450,
      queueGroup: 'aram',
      gameMode: 'ARAM',
    })

    // Summoner's Rift by default: Arena and ARAM are different games, and
    // averaging them in produces a number that describes neither.
    const byDefault = await client.get('/api/groups/arigafion/feed?date=2026-09-16')
    assert.equal(byDefault.body().totals.games, 1)

    const everything = await client.get('/api/groups/arigafion/feed?date=2026-09-16&scope=all')
    assert.equal(everything.body().totals.games, 2)
  })

  test('rejects a scope that is not a real one', async ({ client }) => {
    await seedGroup()
    const response = await client.get('/api/groups/arigafion/feed?scope=nonsense')
    response.assertStatus(422)
  })

  test('serves live games from the cache and hides other groups', async ({ client, assert }) => {
    const seeded = await seedGroup()

    await redis.set(
      'live:games',
      JSON.stringify([
        {
          gameId: 1,
          platform: 'EUW1',
          queueId: 420,
          gameMode: 'CLASSIC',
          startedAt: '2026-09-16T20:00:00.000Z',
          lengthSeconds: 600,
          participants: [
            { puuid: seeded.account.puuid, teamId: 100, championId: 266, spell1Id: 4, spell2Id: 12, riotId: 'Patate#CCC', tracked: true },
            { puuid: 'stranger', teamId: 200, championId: 103, spell1Id: 4, spell2Id: 14, riotId: 'Foe#EUW', tracked: false },
          ],
        },
        {
          gameId: 2,
          platform: 'EUW1',
          queueId: 420,
          gameMode: 'CLASSIC',
          startedAt: '2026-09-16T20:00:00.000Z',
          lengthSeconds: 600,
          participants: [
            { puuid: 'someone-elses-group', teamId: 100, championId: 1, spell1Id: 4, spell2Id: 12, riotId: 'Other#EUW', tracked: true },
          ],
        },
      ])
    )

    const response = await client.get('/api/groups/arigafion/live')
    const body = response.body()

    assert.lengthOf(body.games, 1, 'the cache is global; the endpoint is not')
    assert.lengthOf(body.games[0].participants, 2, 'the opponent is the point')
    assert.equal(body.games[0].participants[0].displayName, 'Patate')
    assert.isFalse(body.games[0].participants[1].tracked)
  })
})
