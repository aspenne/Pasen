import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import StaticChampion from '#models/static_champion'
import StaticItem from '#models/static_item'
import StaticRune from '#models/static_rune'

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
    assert.deepEqual(response.body().champions['80'].positions, [
      'TOP',
      'JUNGLE',
      'MIDDLE',
      'UTILITY',
    ])
  })

  test('serves what each item and rune does, for the tooltips', async ({ client, assert }) => {
    await StaticItem.create({
      id: 3157,
      name: "Zhonya's Hourglass",
      plaintext: null,
      description: '105 Ability Power\n50 Armor',
      goldTotal: 3250,
      image: '3157.png',
      version: '16.20.1',
    })
    await StaticRune.create({
      id: 8112,
      kind: 'perk',
      name: 'Electrocute',
      slug: 'Electrocute',
      image: 'perk-images/Styles/Domination/Electrocute/Electrocute.png',
      description: 'Cooldown: 20s',
      version: '16.20.1',
    })

    const response = await client.get('/api/static')
    response.assertStatus(200)
    assert.deepEqual(response.body().items['3157'], {
      name: "Zhonya's Hourglass",
      description: '105 Ability Power\n50 Armor',
      gold: 3250,
    })
    assert.equal(response.body().runes['8112'].description, 'Cooldown: 20s')
  })
})
