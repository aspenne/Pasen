import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'

import FearlessNight from '#models/fearless_night'
import Group from '#models/group'
import { seedGroup, seedMatch } from '#tests/helpers'

test.group('Group directory', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('lists every group with its members and what is happening there', async ({
    client,
    assert,
  }) => {
    const { group: arigafion } = await seedGroup()
    await Group.create({ slug: 'others', name: 'Others', timezone: 'Europe/Paris' })

    // One game today, one long ago: only today's counts.
    await seedMatch('EUW1_TODAY', DateTime.now().minus({ minutes: 40 }), 'puuid-patate')
    await seedMatch('EUW1_OLD', DateTime.now().minus({ days: 3 }), 'puuid-patate')

    await FearlessNight.create({
      groupId: arigafion.id,
      label: 'Vendredi',
      startedAt: DateTime.now().minus({ minutes: 10 }),
      endedAt: null,
      excludedCustomIds: [],
    })

    const response = await client.get('/api/groups')
    response.assertStatus(200)

    const cards = response.body().groups
    assert.deepEqual(
      cards.map((card: { slug: string }) => card.slug),
      ['arigafion', 'others']
    )

    const [first, second] = cards
    assert.equal(first.name, 'ARIGAFION')
    assert.deepEqual(first.members.map((m: { slug: string }) => m.slug), ['patate'])
    assert.equal(first.gamesToday, 1)
    assert.deepEqual(first.fearless, { label: 'Vendredi', burned: 0 })

    assert.deepEqual(second.members, [])
    assert.equal(second.gamesToday, 0)
    assert.isNull(second.fearless)
  })
})
