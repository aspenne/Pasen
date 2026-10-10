import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'

import CustomGame from '#models/custom_game'
import FearlessNight from '#models/fearless_night'
import Group from '#models/group'
import { seedChampions, seedGroup } from '#tests/helpers'

let fingerprint = 0

/**
 * A stored custom with the champions given, by slug (`Champ1`…), alternating
 * sides. It started `startedMinutesAgo` and lasted 10 minutes.
 */
async function customFor(
  group: Group,
  { startedMinutesAgo, champions }: { startedMinutesAgo: number; champions: string[] }
) {
  return CustomGame.create({
    groupId: group.id,
    fingerprint: `fearless-${++fingerprint}-${Date.now()}`,
    playedAt: DateTime.now().minus({ minutes: startedMinutesAgo }),
    duration: 600,
    gameMode: 'CLASSIC',
    mapName: 'Map11',
    playerCount: champions.length,
    label: null,
    winnerOverride: null,
    raw: {
      allPlayers: champions.map((slug, index) => ({
        riotId: `P${index}#EUW`,
        riotIdGameName: `P${index}`,
        championName: slug,
        rawChampionName: `game_character_displayname_${slug}`,
        team: index % 2 === 0 ? 'ORDER' : 'CHAOS',
        isBot: false,
      })),
      events: { Events: [] },
    },
  })
}

test.group('Fearless nights · public', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('answers 204 while the group never had a night', async ({ client }) => {
    await seedGroup()
    const response = await client.get('/api/groups/arigafion/fearless')
    response.assertStatus(204)
  })

  test("shows the latest night with its games' champions burned", async ({ client, assert }) => {
    const { group } = await seedGroup()
    await seedChampions(4)
    await FearlessNight.create({
      groupId: group.id,
      label: 'Vendredi',
      startedAt: DateTime.now().minus({ hours: 1 }),
      endedAt: null,
      excludedCustomIds: [],
    })
    // Ended 20 minutes ago, inside the night.
    await customFor(group, { startedMinutesAgo: 30, champions: ['Champ1', 'Champ2'] })
    // Ended two hours ago, before the night.
    await customFor(group, { startedMinutesAgo: 130, champions: ['Champ3'] })

    const response = await client.get('/api/groups/arigafion/fearless')
    response.assertStatus(200)
    assert.equal(response.body().night.label, 'Vendredi')
    assert.isTrue(response.body().night.active)
    assert.deepEqual(
      response.body().burned.map((burn: { championId: number }) => burn.championId),
      [1, 2]
    )
    assert.equal(response.body().games[0].picks[0].playerName, 'P0')
  })

  test('a night left open closes by itself after six hours', async ({ client, assert }) => {
    const { group } = await seedGroup()
    await FearlessNight.create({
      groupId: group.id,
      label: null,
      startedAt: DateTime.now().minus({ hours: 7 }),
      endedAt: null,
      excludedCustomIds: [],
    })
    const response = await client.get('/api/groups/arigafion/fearless')
    assert.isFalse(response.body().night.active)
  })

  test('404 for a group that does not exist', async ({ client }) => {
    const response = await client.get('/api/groups/nobody/fearless')
    response.assertStatus(404)
  })
})
