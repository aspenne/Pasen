import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'

import User from '#models/user'
import { CaptureDeviceService } from '#customs/capture_device_service'
import { seedGroup, seedMatch } from '#tests/helpers'

const CREDENTIALS = { email: 'admin@pasen.test', password: 'a-long-enough-password' }

function lobby(blueNames: string[], redNames: string[]) {
  const seat = (name: string) => ({ puuid: `puuid-${name}`, name, bot: false })
  return { teams: { blue: blueNames.map(seat), red: redNames.map(seat) } }
}

async function paired() {
  const { group } = await seedGroup()
  const { token } = await new CaptureDeviceService().pair(group, 'PC salon')
  return { group, token }
}

test.group('Role roulette', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('has nothing to show before a lobby arrives', async ({ client, assert }) => {
    await seedGroup()
    const response = await client.get('/api/groups/arigafion/roulette')
    response.assertStatus(200)
    assert.isNull(response.body().lobby)
    assert.isNull(response.body().draw)
    assert.isString(response.body().serverTime)
  })

  test('takes the lobby from the capture app, once per composition', async ({ client, assert }) => {
    const { token } = await paired()
    const body = lobby(['a', 'b'], ['c'])

    const first = await client.post('/api/capture/lobby').header('authorization', `Bearer ${token}`).json(body)
    first.assertStatus(201)
    const again = await client.post('/api/capture/lobby').header('authorization', `Bearer ${token}`).json(body)
    again.assertStatus(200)

    const view = (await client.get('/api/groups/arigafion/roulette')).body()
    assert.equal(view.lobby.source, 'capture')
    assert.isFalse(view.lobby.stale)
    assert.deepEqual(view.lobby.teams.blue.map((s: { name: string }) => s.name), ['a', 'b'])
  })

  test('refuses a lobby without a valid token, or with broken teams', async ({ client }) => {
    const { token } = await paired()
    const anonymous = await client.post('/api/capture/lobby').header('authorization', 'Bearer pasen_nope').json(lobby(['a'], []))
    anonymous.assertStatus(401)
    const broken = await client.post('/api/capture/lobby').header('authorization', `Bearer ${token}`).json({ teams: { blue: 'x' } })
    broken.assertStatus(422)
  })

  test('only the admin edits the teams or draws', async ({ client }) => {
    await seedGroup()
    const edit = await client.put('/api/admin/groups/arigafion/roulette/lobby').json(lobby(['a'], ['b']))
    edit.assertStatus(401)
    const draw = await client.post('/api/admin/groups/arigafion/roulette/draw')
    draw.assertStatus(401)
  })

  test('draws on the current lobby, revealing a moment later', async ({ client, assert }) => {
    await seedGroup()
    const admin = await User.create(CREDENTIALS)

    const none = await client.post('/api/admin/groups/arigafion/roulette/draw').loginAs(admin)
    none.assertStatus(409)

    const edited = await client
      .put('/api/admin/groups/arigafion/roulette/lobby')
      .json(lobby(['a', 'b', 'c', 'd', 'e'], ['f', 'g', 'h', 'i']))
      .loginAs(admin)
    edited.assertStatus(200)

    const drawn = await client.post('/api/admin/groups/arigafion/roulette/draw').loginAs(admin)
    drawn.assertStatus(201)

    const view = (await client.get('/api/groups/arigafion/roulette')).body()
    assert.equal(view.lobby.source, 'manual')
    assert.sameMembers(view.draw.roles.blue, [0, 1, 2, 3, 4])
    assert.sameMembers(view.draw.roles.red, [0, 1, 2, 3, null])
    assert.isAbove(Date.parse(view.draw.revealAt), Date.parse(view.serverTime))
  })

  test('a new lobby clears the draw made on the previous one', async ({ client, assert }) => {
    const { token } = await paired()
    const admin = await User.create(CREDENTIALS)
    await client.post('/api/capture/lobby').header('authorization', `Bearer ${token}`).json(lobby(['a'], ['b']))
    await client.post('/api/admin/groups/arigafion/roulette/draw').loginAs(admin)

    await client.post('/api/capture/lobby').header('authorization', `Bearer ${token}`).json(lobby(['a', 'c'], ['b']))
    const view = (await client.get('/api/groups/arigafion/roulette')).body()
    assert.isNull(view.draw)
  })

  test("gives a member's card, and none for a stranger", async ({ client, assert }) => {
    const { token } = await paired()
    await seedMatch('EUW1_1', DateTime.now().minus({ days: 1 }), 'puuid-patate', {}, { championId: 266, championName: 'Aatrox' })

    await client
      .post('/api/capture/lobby')
      .header('authorization', `Bearer ${token}`)
      .json({ teams: { blue: [{ puuid: 'puuid-patate', name: 'Patate#CCC', bot: false }], red: [{ puuid: 'stranger', name: 'Guest#EUW', bot: false }] } })

    const cards = (await client.get('/api/groups/arigafion/roulette/cards')).body().cards
    assert.equal(cards['puuid-patate'].slug, 'patate')
    assert.equal(cards['puuid-patate'].championName, 'Aatrox')
    assert.equal(cards['puuid-patate'].games, 1)
    assert.notProperty(cards, 'stranger')
  })
})

test.group('Role roulette · corrections', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test("the app's next poll does not undo the admin's correction", async ({ client, assert }) => {
    const { token } = await paired()
    const admin = await User.create(CREDENTIALS)
    const send = () => client.post('/api/capture/lobby').header('authorization', `Bearer ${token}`).json(lobby(['a', 'b'], ['c']))

    await send()
    await client.put('/api/admin/groups/arigafion/roulette/lobby').json(lobby(['a'], ['b', 'c'])).loginAs(admin)
    const again = await send()
    again.assertStatus(200)

    const view = (await client.get('/api/groups/arigafion/roulette')).body()
    assert.equal(view.lobby.source, 'manual')
    assert.deepEqual(view.lobby.teams.red.map((s: { name: string }) => s.name), ['b', 'c'])

    // The real lobby changing does win: someone actually moved in the client.
    await client.post('/api/capture/lobby').header('authorization', `Bearer ${token}`).json(lobby(['a', 'd'], ['c']))
    const after = (await client.get('/api/groups/arigafion/roulette')).body()
    assert.equal(after.lobby.source, 'capture')
  })
})

test.group('Role roulette · hand-picked teams', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a member added by Riot ID gets their account, and so their card', async ({ client, assert }) => {
    await seedGroup()
    const admin = await User.create(CREDENTIALS)

    await client
      .put('/api/admin/groups/arigafion/roulette/lobby')
      .json({ teams: { blue: [{ puuid: null, name: 'patate#ccc', bot: false }], red: [{ puuid: null, name: 'Guest#EUW', bot: false }] } })
      .loginAs(admin)

    const view = (await client.get('/api/groups/arigafion/roulette')).body()
    assert.equal(view.lobby.teams.blue[0].puuid, 'puuid-patate')
    assert.isNull(view.lobby.teams.red[0].puuid)
  })
})
