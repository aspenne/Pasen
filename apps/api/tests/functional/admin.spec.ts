import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import Member from '#models/member'
import RiotAccount from '#models/riot_account'
import User from '#models/user'
import { seedGroup } from '#tests/helpers'

const CREDENTIALS = { email: 'admin@pasen.test', password: 'a-long-enough-password' }

async function seedAdmin() {
  return User.create(CREDENTIALS)
}

test.group('Admin API', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('refuses every write without a session', async ({ client }) => {
    await seedGroup()

    for (const response of [
      await client.get('/api/admin/status'),
      await client.post('/api/admin/riot-key').json({ key: 'RGAPI-something' }),
      await client.post('/api/admin/groups').json({ name: 'Intruders' }),
      await client.delete('/api/admin/accounts/1'),
    ]) {
      response.assertStatus(401)
    }
  })

  test('signs in and reports who is signed in', async ({ client, assert }) => {
    const admin = await seedAdmin()

    const anonymous = await client.get('/api/admin/session')
    assert.isFalse(anonymous.body().authenticated)

    const login = await client.post('/api/admin/session').json(CREDENTIALS)
    login.assertStatus(201)

    const session = await client.get('/api/admin/session').loginAs(admin)
    assert.isTrue(session.body().authenticated)
    assert.equal(session.body().email, CREDENTIALS.email)
  })

  test('rejects a wrong password', async ({ client }) => {
    await seedAdmin()

    const response = await client
      .post('/api/admin/session')
      .json({ ...CREDENTIALS, password: 'not-the-password' })

    response.assertStatus(400)
  })

  test('answers an unknown address exactly as it answers a wrong password', async ({
    client,
    assert,
  }) => {
    await seedAdmin()

    const wrongPassword = await client
      .post('/api/admin/session')
      .json({ ...CREDENTIALS, password: 'not-the-password' })
    const unknownEmail = await client
      .post('/api/admin/session')
      .json({ email: 'nobody@pasen.test', password: 'a-long-enough-password' })

    // Anything else tells an attacker which addresses exist.
    assert.equal(wrongPassword.status(), unknownEmail.status())
    assert.deepEqual(wrongPassword.body(), unknownEmail.body())
  })

  test('never returns the riot key, only its fingerprint', async ({ client, assert }) => {
    const admin = await seedAdmin()

    await client
      .post('/api/admin/riot-key')
      .json({ key: 'RGAPI-0123456789-secret-tail' })
      .loginAs(admin)

    const status = await client.get('/api/admin/status').loginAs(admin)

    assert.notInclude(JSON.stringify(status.body()), 'secret-tail')
    assert.isTrue(status.body().riotKey.hasKey)
    assert.isString(status.body().riotKey.fingerprint)
  })

  test('reports what is left of the riot budget', async ({ client, assert }) => {
    const admin = await seedAdmin()
    await client.post('/api/admin/riot-key').json({ key: 'RGAPI-test' }).loginAs(admin)

    const status = await client.get('/api/admin/status').loginAs(admin)
    const budget = status.body().budget as { windowSeconds: number; limit: number }[]

    assert.isAbove(budget.length, 0)
    assert.isAbove(budget[0].limit, 0)
  })

  test('rejects a riot id that is not Name#TAG', async ({ client }) => {
    const admin = await seedAdmin()
    await seedGroup()

    const response = await client
      .post('/api/admin/groups/arigafion/accounts')
      .json({ riotId: 'no-tag-here', platform: 'euw1' })
      .loginAs(admin)

    response.assertStatus(422)
  })

  test('rejects a platform that does not exist', async ({ client }) => {
    const admin = await seedAdmin()
    await seedGroup()

    const response = await client
      .post('/api/admin/groups/arigafion/accounts')
      .json({ riotId: 'Someone#EUW', platform: 'euw' })
      .loginAs(admin)

    response.assertStatus(422)
  })

  test('renames a member and sets their colour', async ({ client, assert }) => {
    const admin = await seedAdmin()
    await seedGroup()

    const response = await client
      .patch('/api/admin/members/patate')
      .json({ displayName: 'La Patate', accentColor: '#d4af5a' })
      .loginAs(admin)

    response.assertStatus(200)
    const member = await Member.findByOrFail('slug', 'patate')
    assert.equal(member.displayName, 'La Patate')
    assert.equal(member.accentColor, '#d4af5a')
  })

  test('removing an account takes the member with it only if it was their last', async ({
    client,
    assert,
  }) => {
    const admin = await seedAdmin()
    const seeded = await seedGroup()

    const smurf = await RiotAccount.create({
      memberId: seeded.member.id,
      puuid: 'puuid-smurf',
      gameName: 'Patate',
      tagLine: 'SMURF',
      platform: 'euw1',
      backfillState: 'done',
    })

    await client.delete(`/api/admin/accounts/${smurf.id}`).loginAs(admin)
    assert.isNotNull(await Member.find(seeded.member.id), 'they still have their main')

    await client.delete(`/api/admin/accounts/${seeded.account.id}`).loginAs(admin)
    assert.isNull(await Member.find(seeded.member.id))
  })

  test('queues an account for a fresh backfill', async ({ client, assert }) => {
    const admin = await seedAdmin()
    const seeded = await seedGroup()
    seeded.account.backfillState = 'failed'
    seeded.account.backfillError = 'something went wrong'
    await seeded.account.save()

    await client.post(`/api/admin/accounts/${seeded.account.id}/resync`).loginAs(admin)

    await seeded.account.refresh()
    assert.equal(seeded.account.backfillState, 'pending')
    assert.isNull(seeded.account.backfillError)
    assert.isNull(seeded.account.syncedFrom, 'the walk restarts from the newest match')
  })
})
