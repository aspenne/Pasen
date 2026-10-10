import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import User from '#models/user'

const CREDENTIALS = { email: 'admin@pasen.test', password: 'a-long-enough-password' }

test.group('Admin session', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  /*
   * Long enough to come back the next evening still signed in; each request
   * pushes it back, so only a week without a visit asks for the password.
   */
  test('keeps the admin signed in for a week', async ({ client, assert }) => {
    await User.create(CREDENTIALS)

    const login = await client.post('/api/admin/session').json(CREDENTIALS)
    login.assertStatus(201)

    const cookie = ([] as string[])
      .concat(login.header('set-cookie') ?? [])
      .find((line) => line.startsWith('adonis-session='))
    assert.match(cookie ?? '', /Max-Age=604800/)
  })
})
