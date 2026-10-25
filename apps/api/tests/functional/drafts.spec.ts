import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'

import CustomGame from '#models/custom_game'
import FearlessNight from '#models/fearless_night'
import User from '#models/user'
import { seedChampions, seedGroup } from '#tests/helpers'

const CREDENTIALS = { email: 'admin@pasen.test', password: 'a-long-enough-password' }
const BASE = '/api/groups/arigafion/drafts'

async function setup() {
  await seedGroup()
  await seedChampions(30)
}

test.group('Drafts', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('starts a draft, and only one at a time', async ({ client, assert }) => {
    await setup()
    assert.equal((await client.get(`${BASE}/current`)).status(), 204)

    const created = await client.post(BASE)
    created.assertStatus(201)
    assert.equal(created.body().current.step, 0)
    assert.equal(created.body().current.side, 'blue')
    assert.equal(created.body().current.kind, 'ban')

    const again = await client.post(BASE)
    again.assertStatus(409)
  })

  test('the first to click takes a seat, and keeps it to themselves', async ({ client, assert }) => {
    await setup()
    const { id } = (await client.post(BASE)).body()

    const blue = await client.post(`${BASE}/${id}/seats`).json({ side: 'blue' })
    blue.assertStatus(201)
    assert.isString(blue.body().token)
    const stolen = await client.post(`${BASE}/${id}/seats`).json({ side: 'blue' })
    stolen.assertStatus(409)

    const view = (await client.get(`${BASE}/current`)).body()
    assert.deepEqual(view.seats, { blue: true, red: false })
    assert.notInclude(JSON.stringify(view), blue.body().token)

    const left = await client.delete(`${BASE}/${id}/seats/blue`).header('x-draft-seat', blue.body().token)
    left.assertStatus(204)
    assert.deepEqual((await client.get(`${BASE}/current`)).body().seats, { blue: false, red: false })
  })

  test('only the side whose turn it is plays, with its seat', async ({ client, assert }) => {
    await setup()
    const { id } = (await client.post(BASE)).body()
    const blue = (await client.post(`${BASE}/${id}/seats`).json({ side: 'blue' })).body().token
    const red = (await client.post(`${BASE}/${id}/seats`).json({ side: 'red' })).body().token

    const outOfTurn = await client.post(`${BASE}/${id}/actions`).header('x-draft-seat', red).json({ championId: 1 })
    outOfTurn.assertStatus(403)
    const noSeat = await client.post(`${BASE}/${id}/actions`).json({ championId: 1 })
    noSeat.assertStatus(401)

    const hover = await client.put(`${BASE}/${id}/hover`).header('x-draft-seat', blue).json({ championId: 2 })
    hover.assertStatus(200)
    assert.equal((await client.get(`${BASE}/current`)).body().hover, 2)

    const banned = await client.post(`${BASE}/${id}/actions`).header('x-draft-seat', blue).json({ championId: 2 })
    banned.assertStatus(201)
    const view = (await client.get(`${BASE}/current`)).body()
    assert.deepEqual(view.actions[0], { step: 0, side: 'blue', kind: 'ban', championId: 2, role: null })
    assert.isNull(view.hover)
    assert.equal(view.current.side, 'red')

    const twice = await client.post(`${BASE}/${id}/actions`).header('x-draft-seat', red).json({ championId: 2 })
    twice.assertStatus(422)
  })

  test('plays a whole draft to the end, picks landing on roles', async ({ client, assert }) => {
    await setup()
    const { id } = (await client.post(BASE)).body()
    const tokens = {
      blue: (await client.post(`${BASE}/${id}/seats`).json({ side: 'blue' })).body().token,
      red: (await client.post(`${BASE}/${id}/seats`).json({ side: 'red' })).body().token,
    }
    for (let champion = 1; champion <= 20; champion++) {
      const { current } = (await client.get(`${BASE}/current`)).body()
      const response = await client
        .post(`${BASE}/${id}/actions`)
        .header('x-draft-seat', tokens[current.side as 'blue' | 'red'])
        .json({ championId: champion })
      response.assertStatus(201)
    }
    const view = (await client.get(`${BASE}/current`)).body()
    assert.isNull(view.current)
    assert.isString(view.finishedAt)
    const bluePickRoles = view.actions.filter((a: any) => a.side === 'blue' && a.kind === 'pick').map((a: any) => a.role)
    assert.sameMembers(bluePickRoles, ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'])

    // A finished draft makes way for the next one.
    ;(await client.post(BASE)).assertStatus(201)
  })

  test("refuses a champion burned in tonight's fearless night, and lists the night's drafts", async ({ client, assert }) => {
    const { group } = await seedGroup()
    await seedChampions(5)
    const night = await FearlessNight.create({ groupId: group.id, label: null, startedAt: DateTime.now().minus({ hours: 1 }), endedAt: null, excludedCustomIds: [] })
    await CustomGame.create({
      groupId: group.id,
      fingerprint: 'burn-champ1',
      playedAt: DateTime.now().minus({ minutes: 30 }),
      duration: 600,
      gameMode: 'CLASSIC',
      mapName: 'Map11',
      playerCount: 1,
      label: null,
      winnerOverride: null,
      raw: { allPlayers: [{ riotId: 'A#1', championName: 'Champ1', rawChampionName: 'game_character_displayname_Champ1', team: 'ORDER', isBot: false }], events: { Events: [] } },
    })

    const { id } = (await client.post(BASE)).body()
    const blue = (await client.post(`${BASE}/${id}/seats`).json({ side: 'blue' })).body().token
    const view = (await client.get(`${BASE}/current`)).body()
    assert.deepEqual(view.burned, [1])
    assert.equal(view.nightId, night.id)

    const burned = await client.post(`${BASE}/${id}/actions`).header('x-draft-seat', blue).json({ championId: 1 })
    burned.assertStatus(422)

    const history = (await client.get(`${BASE}?night=${night.id}`)).body()
    assert.lengthOf(history.drafts, 1)
  })

  test('the admin frees a seat and cancels a draft', async ({ client, assert }) => {
    await setup()
    const admin = await User.create(CREDENTIALS)
    const { id } = (await client.post(BASE)).body()
    await client.post(`${BASE}/${id}/seats`).json({ side: 'red' })

    ;(await client.delete(`/api/admin/drafts/${id}/seats/red`)).assertStatus(401)
    ;(await client.delete(`/api/admin/drafts/${id}/seats/red`).loginAs(admin)).assertStatus(204)
    assert.deepEqual((await client.get(`${BASE}/current`)).body().seats, { blue: false, red: false })

    ;(await client.delete(`/api/admin/drafts/${id}`).loginAs(admin)).assertStatus(204)
    assert.equal((await client.get(`${BASE}/current`)).status(), 204)
  })

  test('two locks at the same moment: one goes through, the other is told someone was quicker', async ({ client, assert }) => {
    await setup()
    const { id } = (await client.post(BASE)).body()
    const blue = (await client.post(`${BASE}/${id}/seats`).json({ side: 'blue' })).body().token
    const lock = (championId: number) =>
      client.post(`${BASE}/${id}/actions`).header('x-draft-seat', blue).json({ championId })
    const statuses = (await Promise.all([lock(3), lock(4)])).map((r) => r.status()).sort()
    assert.deepEqual(statuses, [201, 409])
    assert.lengthOf((await client.get(`${BASE}/current`)).body().actions, 1)
  })

  test('two people starting a draft at once make one draft, not two', async ({ client, assert }) => {
    await setup()
    const statuses = (await Promise.all([client.post(BASE), client.post(BASE), client.post(BASE)]))
      .map((r) => r.status())
      .sort()
    assert.deepEqual(statuses, [201, 409, 409])
  })
})
