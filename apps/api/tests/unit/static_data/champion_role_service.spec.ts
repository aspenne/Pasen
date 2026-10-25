import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import StaticChampion from '#models/static_champion'
import { ChampionRoleService } from '#static_data/champion_roles'
import { seedChampions } from '#tests/helpers'

const answer = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch

test.group('ChampionRoleService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('keeps the roles it has when Meraki answers with almost nothing', async ({ assert }) => {
    await seedChampions(3)
    await StaticChampion.query().where('id', 1).update({ positions: JSON.stringify(['MIDDLE']) })

    const written = await new ChampionRoleService({ fetch: answer({}) }).sync()
    assert.equal(written, 0)
    assert.deepEqual((await StaticChampion.findOrFail(1)).positions, ['MIDDLE'])
  })
})
