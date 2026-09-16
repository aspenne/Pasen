import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'

import { seedChampions, seedGroup, seedMatch } from '#tests/helpers'

const AT = DateTime.fromISO('2026-09-16T20:00:00', { zone: 'Europe/Paris' })

test.group('Member API', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('answers 404 for a member who does not exist', async ({ client }) => {
    const response = await client.get('/api/members/nobody')
    response.assertStatus(404)
  })

  test('returns the profile with its accounts', async ({ client, assert }) => {
    await seedGroup()

    const response = await client.get('/api/members/patate')

    response.assertStatus(200)
    assert.equal(response.body().displayName, 'Patate')
    assert.equal(response.body().accounts[0].riotId, 'Patate#CCC')
  })

  test('counts the champion pool against the synced roster, not a constant', async ({
    client,
    assert,
  }) => {
    const seeded = await seedGroup()
    await seedChampions(173)

    await seedMatch('EUW1_1', AT, seeded.account.puuid, {}, { championId: 1, championName: 'Champ 1' })
    await seedMatch('EUW1_2', AT, seeded.account.puuid, {}, { championId: 2, championName: 'Champ 2' })
    await seedMatch('EUW1_3', AT, seeded.account.puuid, {}, { championId: 1, championName: 'Champ 1' })

    const response = await client.get('/api/members/patate/champions')
    const body = response.body()

    assert.equal(body.played, 2)
    assert.equal(body.available, 173, 'Riot keeps adding champions; the count is a query')
    assert.equal(body.entries[0].championId, 1)
    assert.equal(body.entries[0].games, 2)
  })

  test('keeps custom and bot games out of the pool', async ({ client, assert }) => {
    const seeded = await seedGroup()
    await seedChampions(5)

    await seedMatch('EUW1_real', AT, seeded.account.puuid, {}, { championId: 1 })
    await seedMatch(
      'EUW1_custom',
      AT,
      seeded.account.puuid,
      { queueId: 0, queueGroup: 'other', statsEligible: false },
      { championId: 2 }
    )

    const response = await client.get('/api/members/patate/champions')
    assert.equal(response.body().played, 1)
  })

  test('treats a deathless game as a perfect kda rather than dividing by zero', async ({
    client,
    assert,
  }) => {
    const seeded = await seedGroup()
    await seedChampions(5)
    await seedMatch(
      'EUW1_perfect',
      AT,
      seeded.account.puuid,
      {},
      { championId: 1, kills: 10, deaths: 0, assists: 5 }
    )

    const response = await client.get('/api/members/patate/champions')
    assert.equal(response.body().entries[0].kda, 15)
  })

  test('pages history with a stable cursor', async ({ client, assert }) => {
    const seeded = await seedGroup()

    for (let i = 0; i < 5; i++) {
      await seedMatch(`EUW1_${i}`, AT.minus({ hours: i }), seeded.account.puuid)
    }

    const first = await client.get('/api/members/patate/matches?limit=2')
    assert.lengthOf(first.body().entries, 2)
    assert.isNotNull(first.body().nextCursor)

    const second = await client.get(
      `/api/members/patate/matches?limit=2&cursor=${first.body().nextCursor}`
    )

    const firstIds = first.body().entries.map((e: any) => e.matchId)
    const secondIds = second.body().entries.map((e: any) => e.matchId)
    assert.isEmpty(
      firstIds.filter((id: string) => secondIds.includes(id)),
      'a cursor must not repeat or skip a match when new games arrive'
    )
  })

  test('reports the end of history with a null cursor', async ({ client, assert }) => {
    const seeded = await seedGroup()
    await seedMatch('EUW1_only', AT, seeded.account.puuid)

    const response = await client.get('/api/members/patate/matches?limit=20')
    assert.isNull(response.body().nextCursor)
  })

  test('rejects a malformed cursor instead of returning the first page again', async ({
    client,
  }) => {
    await seedGroup()
    const response = await client.get('/api/members/patate/matches?cursor=not-a-cursor')
    response.assertStatus(400)
  })

  test('filters history by queue', async ({ client, assert }) => {
    const seeded = await seedGroup()
    await seedMatch('EUW1_ranked', AT, seeded.account.puuid)
    await seedMatch('EUW1_aram', AT, seeded.account.puuid, {
      queueId: 450,
      queueGroup: 'aram',
      gameMode: 'ARAM',
    })

    const response = await client.get('/api/members/patate/matches?queue=aram')

    assert.lengthOf(response.body().entries, 1)
    assert.equal(response.body().entries[0].matchId, 'EUW1_aram')
  })
})
