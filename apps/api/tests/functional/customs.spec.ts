import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'
import testUtils from '@adonisjs/core/services/test_utils'

import User from '#models/user'
import { seedGroup } from '#tests/helpers'

const CREDENTIALS = { email: 'admin@pasen.test', password: 'a-long-enough-password' }

/**
 * The four fields the agent itself reads, which is the whole contract the
 * upload relies on. Everything else a real capture carries rides along in
 * `raw` and is not inspected yet.
 */
function capture(over: Record<string, unknown> = {}) {
  return {
    gameData: { gameMode: 'CLASSIC', gameTime: 1823.4, mapName: "Summoner's Rift" },
    allPlayers: [
      { summonerName: 'froslass', championName: 'Ezreal', team: 'ORDER' },
      { summonerName: 'MATIOU GOAT', championName: 'Ekko', team: 'CHAOS' },
    ],
    events: { Events: [{ EventID: 0, EventName: 'GameStart', EventTime: 0 }] },
    ...over,
  }
}

test.group('Custom game uploads', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('keeps the upload behind the admin session', async ({ client }) => {
    await seedGroup()

    const anonymous = await client
      .post('/api/admin/groups/arigafion/customs')
      .json({ capture: capture() })

    anonymous.assertStatus(401)
  })

  test('stores a capture and reports what it found in it', async ({ client, assert }) => {
    await seedGroup()
    const admin = await User.create(CREDENTIALS)

    const response = await client
      .post('/api/admin/groups/arigafion/customs')
      .json({
        capture: capture(),
        fileName: 'custom-2026-10-05T21-14-07-882Z.json',
        label: 'Inhouse du vendredi',
      })
      .loginAs(admin)

    response.assertStatus(201)
    assert.equal(response.body().gameMode, 'CLASSIC')
    assert.equal(response.body().playerCount, 2)
    assert.equal(response.body().duration, 1823)
    assert.equal(response.body().label, 'Inhouse du vendredi')
    assert.isFalse(response.body().duplicate)

    /*
     * The payload has no wall clock, so the start is the capture stamp wound
     * back by the game clock: 21:14:07 less 1823 seconds.
     */
    assert.equal(response.body().playedAt.slice(0, 19), '2026-10-05T20:43:44')
  })

  test('answers the same row rather than storing a capture twice', async ({ client, assert }) => {
    await seedGroup()
    const admin = await User.create(CREDENTIALS)

    const first = await client
      .post('/api/admin/groups/arigafion/customs')
      .json({ capture: capture(), fileName: 'custom-2026-10-05T21-14-07-882Z.json' })
      .loginAs(admin)
    const again = await client
      .post('/api/admin/groups/arigafion/customs')
      .json({ capture: capture(), fileName: 'custom-2026-10-05T21-14-07-882Z.json' })
      .loginAs(admin)

    first.assertStatus(201)
    again.assertStatus(200)
    assert.isTrue(again.body().duplicate)
    assert.equal(again.body().id, first.body().id)

    const list = await client.get('/api/admin/groups/arigafion/customs').loginAs(admin)
    assert.lengthOf(list.body(), 1)
  })

  test('turns away a file that did not come from the agent', async ({ client, assert }) => {
    await seedGroup()
    const admin = await User.create(CREDENTIALS)

    for (const bad of [{}, { allPlayers: [] }, { allPlayers: [{}], gameData: {} }, 'not json']) {
      const response = await client
        .post('/api/admin/groups/arigafion/customs')
        .json({ capture: bad })
        .loginAs(admin)

      response.assertStatus(422)
      assert.isString(response.body().message)
    }
  })

  test('removes one that should not have been kept', async ({ client, assert }) => {
    await seedGroup()
    const admin = await User.create(CREDENTIALS)

    const stored = await client
      .post('/api/admin/groups/arigafion/customs')
      .json({ capture: capture() })
      .loginAs(admin)

    const removed = await client.delete(`/api/admin/customs/${stored.body().id}`).loginAs(admin)
    removed.assertStatus(204)

    const list = await client.get('/api/admin/groups/arigafion/customs').loginAs(admin)
    assert.lengthOf(list.body(), 0)
  })
})

test.group('Custom games, read side', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('serves an uploaded capture to anyone, resolved for the page', async ({ client, assert }) => {
    await seedGroup()
    const admin = await User.create(CREDENTIALS)
    const raw = JSON.parse(
      await readFile(new URL('../fixtures/customs/vs_bots.json', import.meta.url), 'utf8')
    )

    const stored = await client
      .post('/api/admin/groups/arigafion/customs')
      .json({ capture: raw, fileName: 'custom-2026-10-06T19-37-52-000Z.json' })
      .loginAs(admin)
    stored.assertStatus(201)

    // No session: reading is public, like every other page of the site.
    const list = await client.get('/api/groups/arigafion/customs')
    list.assertStatus(200)
    assert.lengthOf(list.body().games, 1)

    const detail = await client.get(`/api/groups/arigafion/customs/${stored.body().id}`)
    detail.assertStatus(200)
    assert.lengthOf(detail.body().teams, 2)
    assert.isTrue(detail.body().againstBots)
    assert.isTrue(detail.body().resultKnown)
  })

  test('does not serve a custom from another group, or one that does not exist', async ({ client }) => {
    await seedGroup()

    const missing = await client.get('/api/groups/arigafion/customs/999999')
    missing.assertStatus(404)
  })
})

test.group('Custom games, deciding the winner', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function upload(client: any) {
    await seedGroup()
    const admin = await User.create(CREDENTIALS)
    const raw = JSON.parse(
      await readFile(new URL('../fixtures/customs/vs_bots.json', import.meta.url), 'utf8')
    )
    const stored = await client
      .post('/api/admin/groups/arigafion/customs')
      .json({ capture: raw })
      .loginAs(admin)
    return { admin, id: stored.body().id as number }
  }

  test('only an admin can decide', async ({ client }) => {
    const { id } = await upload(client)

    const anonymous = await client.patch(`/api/admin/customs/${id}`).json({ winner: 'CHAOS' })
    anonymous.assertStatus(401)
  })

  test('a decision shows on the public page, and clearing it restores the capture', async ({
    client,
    assert,
  }) => {
    const { admin, id } = await upload(client)

    const decided = await client
      .patch(`/api/admin/customs/${id}`)
      .json({ winner: 'CHAOS' })
      .loginAs(admin)
    decided.assertStatus(200)

    const after = await client.get(`/api/groups/arigafion/customs/${id}`)
    assert.equal(after.body().resultSource, 'manual')
    assert.isTrue(after.body().teams.find((t: any) => t.side === 'CHAOS').won)

    await client.patch(`/api/admin/customs/${id}`).json({ winner: null }).loginAs(admin)

    const restored = await client.get(`/api/groups/arigafion/customs/${id}`)
    assert.equal(restored.body().resultSource, 'capture')
    assert.isTrue(restored.body().teams.find((t: any) => t.side === 'ORDER').won)
  })

  test('renames without touching the result', async ({ client, assert }) => {
    const { admin, id } = await upload(client)

    await client.patch(`/api/admin/customs/${id}`).json({ label: 'Inhouse du vendredi' }).loginAs(admin)

    const after = await client.get(`/api/groups/arigafion/customs/${id}`)
    assert.equal(after.body().label, 'Inhouse du vendredi')
    assert.equal(after.body().resultSource, 'capture')
  })

  test('refuses a side that does not exist', async ({ client }) => {
    const { admin, id } = await upload(client)

    const bad = await client.patch(`/api/admin/customs/${id}`).json({ winner: 'PURPLE' }).loginAs(admin)
    bad.assertStatus(422)
  })
})

test.group('Custom games, standings', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function fixture() {
    return JSON.parse(
      await readFile(new URL('../fixtures/customs/vs_bots.json', import.meta.url), 'utf8')
    )
  }

  test('keeps practice against bots out, and says it did', async ({ client, assert }) => {
    await seedGroup()
    const admin = await User.create(CREDENTIALS)
    await client
      .post('/api/admin/groups/arigafion/customs')
      .json({ capture: await fixture() })
      .loginAs(admin)

    const response = await client.get('/api/groups/arigafion/customs/standings')
    response.assertStatus(200)
    assert.lengthOf(response.body().standings, 0)
    assert.equal(response.body().skipped.againstBots, 1)
  })

  test('credits every human in an inhouse, on whichever side won', async ({ client, assert }) => {
    await seedGroup()
    const admin = await User.create(CREDENTIALS)

    // The same game with two friends on each side instead of bots.
    const raw = await fixture()
    const humans: Record<number, string> = { 1: 'Bea', 5: 'Cyd', 6: 'Dan' }
    for (const [index, name] of Object.entries(humans)) {
      const player = raw.allPlayers[Number(index)]
      player.isBot = false
      player.riotId = `${name}#EUW`
      player.riotIdGameName = name
      player.summonerName = name
    }

    await client
      .post('/api/admin/groups/arigafion/customs')
      .json({ capture: raw })
      .loginAs(admin)

    const { standings, counted } = (await client.get('/api/groups/arigafion/customs/standings')).body()

    assert.equal(counted, 1)
    assert.lengthOf(standings, 4)
    // 3C Patate Chaude and Bea were on ORDER, which the capture says won.
    assert.sameMembers(
      standings.filter((row: any) => row.wins === 1).map((row: any) => row.name),
      ['3C Patate Chaude', 'Bea']
    )
  })
})


test.group('Custom games, dashboard', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('builds the stats from a real capture turned into an inhouse', async ({ client, assert }) => {
    await seedGroup()
    const admin = await User.create(CREDENTIALS)
    const raw = JSON.parse(
      await readFile(new URL('../fixtures/customs/vs_bots.json', import.meta.url), 'utf8')
    )

    // Practice first: it must not reach the stats.
    await client.post('/api/admin/groups/arigafion/customs').json({ capture: raw }).loginAs(admin)
    const empty = (await client.get('/api/groups/arigafion/customs/dashboard')).body()
    assert.equal(empty.counted, 0)

    // The same game with a friend on each side instead of bots.
    for (const [index, name] of [[1, 'Bea'], [5, 'Cyd']] as const) {
      const player = raw.allPlayers[index]
      player.isBot = false
      player.riotId = `${name}#EUW`
      player.riotIdGameName = name
      player.summonerName = name
    }
    await client.post('/api/admin/groups/arigafion/customs').json({ capture: raw }).loginAs(admin)

    const response = await client.get('/api/groups/arigafion/customs/dashboard')
    response.assertStatus(200)
    const dashboard = response.body()

    assert.equal(dashboard.counted, 1)
    assert.lengthOf(dashboard.players, 3)
    const kills = dashboard.records.find((record: any) => record.kind === 'kills')
    assert.equal(kills.name, '3C Patate Chaude')
    assert.equal(kills.value, 36)
    assert.equal(dashboard.overview.blueWins, 1)
  })
})
