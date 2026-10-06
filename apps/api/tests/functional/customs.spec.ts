import { test } from '@japa/runner'
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
