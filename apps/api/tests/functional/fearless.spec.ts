import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'

import CustomGame from '#models/custom_game'
import FearlessNight from '#models/fearless_night'
import Group from '#models/group'
import User from '#models/user'
import { CaptureDeviceService } from '#customs/capture_device_service'
import { seedChampions, seedGroup } from '#tests/helpers'

const CREDENTIALS = { email: 'admin@pasen.test', password: 'a-long-enough-password' }

let fingerprint = 0

/**
 * A stored custom with the champions given, by slug (`Champ1`…), alternating
 * sides. It started `startedMinutesAgo` and lasted 10 minutes.
 */
async function customFor(
  group: Group,
  { startedMinutesAgo, champions }: { startedMinutesAgo: number; champions: string[] }
) {
  return CustomGame.create({
    groupId: group.id,
    fingerprint: `fearless-${++fingerprint}-${Date.now()}`,
    playedAt: DateTime.now().minus({ minutes: startedMinutesAgo }),
    duration: 600,
    gameMode: 'CLASSIC',
    mapName: 'Map11',
    playerCount: champions.length,
    label: null,
    winnerOverride: null,
    raw: {
      allPlayers: champions.map((slug, index) => ({
        riotId: `P${index}#EUW`,
        riotIdGameName: `P${index}`,
        championName: slug,
        rawChampionName: `game_character_displayname_${slug}`,
        team: index % 2 === 0 ? 'ORDER' : 'CHAOS',
        isBot: false,
      })),
      events: { Events: [] },
    },
  })
}

test.group('Fearless nights · public', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('answers 204 while the group never had a night', async ({ client }) => {
    await seedGroup()
    const response = await client.get('/api/groups/arigafion/fearless')
    response.assertStatus(204)
  })

  test("shows the latest night with its games' champions burned", async ({ client, assert }) => {
    const { group } = await seedGroup()
    await seedChampions(4)
    await FearlessNight.create({
      groupId: group.id,
      label: 'Vendredi',
      startedAt: DateTime.now().minus({ hours: 1 }),
      endedAt: null,
      excludedCustomIds: [],
    })
    // Ended 20 minutes ago, inside the night.
    await customFor(group, { startedMinutesAgo: 30, champions: ['Champ1', 'Champ2'] })
    // Ended two hours ago, before the night.
    await customFor(group, { startedMinutesAgo: 130, champions: ['Champ3'] })

    const response = await client.get('/api/groups/arigafion/fearless')
    response.assertStatus(200)
    assert.equal(response.body().night.label, 'Vendredi')
    assert.isTrue(response.body().night.active)
    assert.deepEqual(
      response.body().burned.map((burn: { championId: number }) => burn.championId),
      [1, 2]
    )
    assert.equal(response.body().games[0].picks[0].playerName, 'P0')
  })

  test('a night left open closes by itself after six hours', async ({ client, assert }) => {
    const { group } = await seedGroup()
    await FearlessNight.create({
      groupId: group.id,
      label: null,
      startedAt: DateTime.now().minus({ hours: 7 }),
      endedAt: null,
      excludedCustomIds: [],
    })
    const response = await client.get('/api/groups/arigafion/fearless')
    assert.isFalse(response.body().night.active)
  })

  test('404 for a group that does not exist', async ({ client }) => {
    const response = await client.get('/api/groups/nobody/fearless')
    response.assertStatus(404)
  })
})

test.group('Fearless nights · admin', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('every write is behind the session', async ({ client }) => {
    await seedGroup()
    const responses = await Promise.all([
      client.post('/api/admin/groups/arigafion/fearless').json({}),
      client.patch('/api/admin/fearless/1').json({ ended: true }),
      client.put('/api/admin/fearless/1/champions/1').json({ kind: 'burn' }),
      client.delete('/api/admin/fearless/1/champions/1'),
    ])
    for (const response of responses) response.assertStatus(401)
  })

  test('starting a night ends the one still open', async ({ client, assert }) => {
    await seedGroup()
    const admin = await User.create(CREDENTIALS)

    const first = await client.post('/api/admin/groups/arigafion/fearless').json({ label: 'Un' }).loginAs(admin)
    first.assertStatus(201)
    const second = await client.post('/api/admin/groups/arigafion/fearless').json({}).loginAs(admin)
    second.assertStatus(201)

    const previous = await FearlessNight.findOrFail(first.body().night.id)
    assert.isNotNull(previous.endedAt)
    assert.isTrue(second.body().night.active)
    assert.isNull(second.body().night.label)
  })

  test('ends a night and renames it', async ({ client, assert }) => {
    await seedGroup()
    const admin = await User.create(CREDENTIALS)
    const { night } = (await client.post('/api/admin/groups/arigafion/fearless').json({}).loginAs(admin)).body()

    const response = await client
      .patch(`/api/admin/fearless/${night.id}`)
      .json({ ended: true, label: 'Finale' })
      .loginAs(admin)
    response.assertStatus(200)
    assert.isFalse(response.body().night.active)
    assert.equal(response.body().night.label, 'Finale')
  })

  test("excludes a game, and keeps only the group's own customs in the list", async ({ client, assert }) => {
    const { group } = await seedGroup()
    await seedChampions(2)
    const admin = await User.create(CREDENTIALS)
    const other = await Group.create({ slug: 'others', name: 'Others', timezone: 'Europe/Paris' })
    const foreign = await customFor(other, { startedMinutesAgo: 5, champions: ['Champ2'] })

    const { night } = (await client.post('/api/admin/groups/arigafion/fearless').json({}).loginAs(admin)).body()
    // Started before the night, ends after it began.
    const game = await customFor(group, { startedMinutesAgo: 5, champions: ['Champ1'] })

    const response = await client
      .patch(`/api/admin/fearless/${night.id}`)
      .json({ excludedCustomIds: [game.id, foreign.id] })
      .loginAs(admin)
    response.assertStatus(200)
    assert.deepEqual(response.body().burned, [])
    assert.isTrue(response.body().games[0].excluded)

    const stored = await FearlessNight.findOrFail(night.id)
    assert.deepEqual(stored.excludedCustomIds, [game.id])
  })

  test('burns, frees and forgets a champion by hand', async ({ client, assert }) => {
    await seedGroup()
    await seedChampions(3)
    const admin = await User.create(CREDENTIALS)
    const { night } = (await client.post('/api/admin/groups/arigafion/fearless').json({}).loginAs(admin)).body()

    const burned = await client
      .put(`/api/admin/fearless/${night.id}/champions/3`)
      .json({ kind: 'burn' })
      .loginAs(admin)
    burned.assertStatus(200)
    assert.deepEqual(burned.body().burned, [{ championId: 3, source: 'manual', by: [] }])

    const freed = await client
      .put(`/api/admin/fearless/${night.id}/champions/3`)
      .json({ kind: 'free' })
      .loginAs(admin)
    assert.deepEqual(freed.body().burned, [])
    assert.deepEqual(freed.body().freed, [3])

    const forgotten = await client.delete(`/api/admin/fearless/${night.id}/champions/3`).loginAs(admin)
    forgotten.assertStatus(200)
    assert.deepEqual(forgotten.body().freed, [])
  })

  test('refuses a champion the site does not know', async ({ client }) => {
    await seedGroup()
    await seedChampions(1)
    const admin = await User.create(CREDENTIALS)
    const { night } = (await client.post('/api/admin/groups/arigafion/fearless').json({}).loginAs(admin)).body()

    const response = await client
      .put(`/api/admin/fearless/${night.id}/champions/999`)
      .json({ kind: 'burn' })
      .loginAs(admin)
    response.assertStatus(422)
  })
})

test.group('Fearless nights · capture app', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a paired PC reads the night of its own group, and only that', async ({ client, assert }) => {
    const { group: own } = await seedGroup()
    const other = await Group.create({ slug: 'others', name: 'Others', timezone: 'Europe/Paris' })
    await FearlessNight.create({
      groupId: other.id,
      label: 'Not yours',
      startedAt: DateTime.now(),
      endedAt: null,
      excludedCustomIds: [],
    })
    const { token } = await new CaptureDeviceService().pair(own, 'PC salon')

    const none = await client.get('/api/capture/fearless').header('authorization', `Bearer ${token}`)
    none.assertStatus(204)

    await FearlessNight.create({
      groupId: own.id,
      label: 'Yours',
      startedAt: DateTime.now(),
      endedAt: null,
      excludedCustomIds: [],
    })
    const mine = await client.get('/api/capture/fearless').header('authorization', `Bearer ${token}`)
    mine.assertStatus(200)
    assert.equal(mine.body().night.label, 'Yours')
  })

  test('refuses a request without a valid token', async ({ client }) => {
    await seedGroup()
    const response = await client.get('/api/capture/fearless').header('authorization', 'Bearer pasen_nope')
    response.assertStatus(401)
  })
})
