import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'
import testUtils from '@adonisjs/core/services/test_utils'

import CaptureDevice from '#models/capture_device'
import User from '#models/user'
import { seedGroup } from '#tests/helpers'

const CREDENTIALS = { email: 'admin@pasen.test', password: 'a-long-enough-password' }

async function capture() {
  return JSON.parse(
    await readFile(new URL('../fixtures/customs/vs_bots.json', import.meta.url), 'utf8')
  )
}

test.group('Capture devices', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('only an admin can pair a PC', async ({ client }) => {
    await seedGroup()

    const anonymous = await client.post('/api/admin/groups/arigafion/devices').json({ name: 'PC salon' })
    anonymous.assertStatus(401)
  })

  test('pairing hands the token over once, and keeps only its hash', async ({ client, assert }) => {
    await seedGroup()
    const admin = await User.create(CREDENTIALS)

    const paired = await client
      .post('/api/admin/groups/arigafion/devices')
      .json({ name: 'PC salon' })
      .loginAs(admin)
    paired.assertStatus(201)
    const { token, id } = paired.body()
    assert.match(token, /^pasen_/)

    const stored = await CaptureDevice.findOrFail(id)
    assert.notEqual(stored.tokenHash, token)
    assert.notInclude(JSON.stringify(stored.serialize()), token)

    const list = await client.get('/api/admin/groups/arigafion/devices').loginAs(admin)
    assert.notProperty(list.body()[0], 'token')
    assert.notProperty(list.body()[0], 'tokenHash')
  })

  test('a paired PC can say who it is and send a game', async ({ client, assert }) => {
    await seedGroup()
    const admin = await User.create(CREDENTIALS)
    const { token } = (
      await client.post('/api/admin/groups/arigafion/devices').json({ name: 'PC salon' }).loginAs(admin)
    ).body()

    const whoami = await client.get('/api/capture/whoami').header('authorization', `Bearer ${token}`)
    whoami.assertStatus(200)
    assert.equal(whoami.body().group.slug, 'arigafion')
    assert.equal(whoami.body().device.name, 'PC salon')

    const sent = await client
      .post('/api/capture/customs')
      .header('authorization', `Bearer ${token}`)
      .json({ capture: await capture(), fileName: 'custom-2026-10-06T19-37-52-000Z.json' })
    sent.assertStatus(201)
    assert.match(sent.body().url, /^\/arigafion\/customs\/\d+$/)

    // Sent twice is stored once.
    const again = await client
      .post('/api/capture/customs')
      .header('authorization', `Bearer ${token}`)
      .json({ capture: await capture() })
    again.assertStatus(200)
    assert.isTrue(again.body().duplicate)
  })

  test('refuses a missing, wrong or revoked token', async ({ client }) => {
    await seedGroup()
    const admin = await User.create(CREDENTIALS)
    const { token, id } = (
      await client.post('/api/admin/groups/arigafion/devices').json({ name: 'PC salon' }).loginAs(admin)
    ).body()

    const missing = await client.post('/api/capture/customs').json({ capture: await capture() })
    missing.assertStatus(401)

    const wrong = await client
      .post('/api/capture/customs')
      .header('authorization', 'Bearer pasen_not-a-real-token')
      .json({ capture: await capture() })
    wrong.assertStatus(401)

    await client.delete(`/api/admin/devices/${id}`).loginAs(admin)
    const revoked = await client.get('/api/capture/whoami').header('authorization', `Bearer ${token}`)
    revoked.assertStatus(401)
  })

  /* The token is for sending customs, not for the rest of the admin. */
  test('a device token opens nothing behind the admin session', async ({ client }) => {
    await seedGroup()
    const admin = await User.create(CREDENTIALS)
    const { token } = (
      await client.post('/api/admin/groups/arigafion/devices').json({ name: 'PC salon' }).loginAs(admin)
    ).body()

    const status = await client.get('/api/admin/status').header('authorization', `Bearer ${token}`)
    status.assertStatus(401)
  })
})
