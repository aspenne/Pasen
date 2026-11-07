import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import User from '#models/user'
import { seedGroup } from '#tests/helpers'

const ADMIN = { email: 'admin@pasen.test', password: 'a-long-enough-password' }
const NEWCOMER = { email: 'newcomer@pasen.test', password: 'another-long-password' }

test.group('Accounts and roles', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('signs a newcomer up as a member, signed in', async ({ client, assert }) => {
    const signUp = await client.post('/api/account').json({ ...NEWCOMER, fullName: 'Noah' })
    signUp.assertStatus(201)
    assert.equal(signUp.body().role, 'member')

    const user = await User.findByOrFail('email', NEWCOMER.email)
    assert.equal(user.role, 'member')
    assert.equal(user.fullName, 'Noah')

    const session = await client.get('/api/admin/session').loginAs(user)
    assert.include(session.body(), { authenticated: true, role: 'member', admin: false })
  })

  test('never lets a sign-up make itself an admin', async ({ client, assert }) => {
    await client.post('/api/account').json({ ...NEWCOMER, role: 'admin' })
    const user = await User.findByOrFail('email', NEWCOMER.email)
    assert.equal(user.role, 'member')
  })

  test('refuses a taken email and a short password', async ({ client }) => {
    await User.create({ ...ADMIN, role: 'admin' })

    const taken = await client.post('/api/account').json({ ...NEWCOMER, email: ADMIN.email })
    taken.assertStatus(409)

    const short = await client.post('/api/account').json({ ...NEWCOMER, password: 'short' })
    short.assertStatus(422)
  })

  test('keeps a member out of the admin routes', async ({ client }) => {
    await seedGroup()
    const member = await User.create({ ...NEWCOMER, role: 'member' })

    for (const response of [
      await client.get('/api/admin/status').loginAs(member),
      await client.post('/api/admin/groups').json({ name: 'Intruders' }).loginAs(member),
      await client.get('/api/admin/users').loginAs(member),
      await client.patch(`/api/admin/users/${member.id}`).json({ role: 'admin' }).loginAs(member),
    ]) {
      response.assertStatus(403)
    }
  })

  test('lets an admin promote a member, who then reaches the admin', async ({ client, assert }) => {
    const admin = await User.create({ ...ADMIN, role: 'admin' })
    const member = await User.create({ ...NEWCOMER, role: 'member' })

    const list = await client.get('/api/admin/users').loginAs(admin)
    list.assertStatus(200)
    assert.deepEqual(
      list.body().users.map((user: { email: string; role: string }) => [user.email, user.role]),
      [
        [ADMIN.email, 'admin'],
        [NEWCOMER.email, 'member'],
      ]
    )

    const promote = await client
      .patch(`/api/admin/users/${member.id}`)
      .json({ role: 'admin' })
      .loginAs(admin)
    promote.assertStatus(200)

    await member.refresh()
    const status = await client.get('/api/admin/status').loginAs(member)
    status.assertStatus(200)
  })

  test('links an account to its player, and unlinks it', async ({ client, assert }) => {
    const seeded = await seedGroup()
    const admin = await User.create({ ...ADMIN, role: 'admin' })
    const member = await User.create({ ...NEWCOMER, role: 'member' })

    const link = await client
      .patch(`/api/admin/users/${member.id}`)
      .json({ memberSlug: seeded.member.slug })
      .loginAs(admin)
    assert.equal(link.body().memberSlug, seeded.member.slug)

    await member.refresh()
    const session = await client.get('/api/admin/session').loginAs(member)
    assert.equal(session.body().memberSlug, seeded.member.slug)

    const unknown = await client
      .patch(`/api/admin/users/${member.id}`)
      .json({ memberSlug: 'nobody' })
      .loginAs(admin)
    unknown.assertStatus(422)

    const unlink = await client
      .patch(`/api/admin/users/${member.id}`)
      .json({ memberSlug: null })
      .loginAs(admin)
    assert.isNull(unlink.body().memberSlug)
  })

  test('will not let an admin demote themself', async ({ client, assert }) => {
    const admin = await User.create({ ...ADMIN, role: 'admin' })

    const response = await client
      .patch(`/api/admin/users/${admin.id}`)
      .json({ role: 'member' })
      .loginAs(admin)
    response.assertStatus(409)

    await admin.refresh()
    assert.equal(admin.role, 'admin')
  })
})
