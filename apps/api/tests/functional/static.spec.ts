import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import StaticChampion from '#models/static_champion'

test.group('Static data', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test("serves each champion's roles, for the role filters", async ({ client, assert }) => {
    await StaticChampion.create({
      id: 80,
      slug: 'Pantheon',
      name: 'Pantheon',
      title: 'the Unbreakable Spear',
      tags: ['Fighter'],
      image: 'Pantheon.png',
      version: '16.20.1',
      positions: ['TOP', 'JUNGLE', 'MIDDLE', 'UTILITY'],
    })
    const response = await client.get('/api/static')
    response.assertStatus(200)
    assert.deepEqual(response.body().champions['80'].positions, ['TOP', 'JUNGLE', 'MIDDLE', 'UTILITY'])
  })
})
