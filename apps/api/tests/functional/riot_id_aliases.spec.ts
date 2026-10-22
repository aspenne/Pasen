import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import RiotAccountAlias from '#models/riot_account_alias'
import User from '#models/user'
import { seedGroup } from '#tests/helpers'

const CREDENTIALS = { email: 'admin@pasen.test', password: 'a-long-enough-password' }

/** A custom where the member played under the name they had before. */
function capture(riotId: string) {
  return {
    gameData: { gameMode: 'CLASSIC', gameTime: 1800, mapName: 'Map11' },
    activePlayer: { riotId },
    allPlayers: [
      { riotId, riotIdGameName: riotId.split('#')[0], championName: 'Ezreal', team: 'ORDER', isBot: false },
      { riotId: 'Friend#EUW', riotIdGameName: 'Friend', championName: 'Ekko', team: 'CHAOS', isBot: false },
    ],
    events: { Events: [{ EventName: 'GameEnd', Result: 'Win', EventTime: 1800 }] },
  }
}

test.group('Riot ID aliases', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a custom played under an old Riot ID still belongs to the member', async ({ client, assert }) => {
    const { account } = await seedGroup()
    await RiotAccountAlias.create({ riotAccountId: account.id, gameName: 'Old Patate', tagLine: 'OLD', source: 'riot' })
    const admin = await User.create(CREDENTIALS)

    const stored = await client
      .post('/api/admin/groups/arigafion/customs')
      .json({ capture: capture('Old Patate#OLD') })
      .loginAs(admin)
    stored.assertStatus(201)

    const game = (await client.get(`/api/groups/arigafion/customs/${stored.body().id}`)).body()
    const players = game.teams.flatMap((t: any) => t.players)
    assert.equal(players.find((p: any) => p.riotId === 'Old Patate#OLD').memberSlug, 'patate')
  })

  test('the roulette recognises a member typed in under an old Riot ID', async ({ client, assert }) => {
    const { account } = await seedGroup()
    await RiotAccountAlias.create({ riotAccountId: account.id, gameName: 'Old Patate', tagLine: 'OLD', source: 'manual' })
    const admin = await User.create(CREDENTIALS)

    await client
      .put('/api/admin/groups/arigafion/roulette/lobby')
      .json({ teams: { blue: [{ puuid: null, name: 'old patate#old', bot: false }], red: [] } })
      .loginAs(admin)
    const view = (await client.get('/api/groups/arigafion/roulette')).body()
    assert.equal(view.lobby.teams.blue[0].puuid, 'puuid-patate')
  })
})

test.group('Riot ID aliases · admin', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('only the admin adds or removes an old Riot ID', async ({ client }) => {
    const { account } = await seedGroup()
    const add = await client.post(`/api/admin/accounts/${account.id}/aliases`).json({ riotId: 'Old#OLD' })
    add.assertStatus(401)
    const remove = await client.delete('/api/admin/aliases/1')
    remove.assertStatus(401)
  })

  test('adds one, lists it with the account, refuses a duplicate, and removes it', async ({ client, assert }) => {
    const { account } = await seedGroup()
    const admin = await User.create(CREDENTIALS)

    const added = await client.post(`/api/admin/accounts/${account.id}/aliases`).json({ riotId: '  Old Patate#OLD ' }).loginAs(admin)
    added.assertStatus(201)
    assert.equal(added.body().riotId, 'Old Patate#OLD')

    const again = await client.post(`/api/admin/accounts/${account.id}/aliases`).json({ riotId: 'old patate#old' }).loginAs(admin)
    again.assertStatus(409)
    const current = await client.post(`/api/admin/accounts/${account.id}/aliases`).json({ riotId: 'Patate#CCC' }).loginAs(admin)
    current.assertStatus(409)
    const malformed = await client.post(`/api/admin/accounts/${account.id}/aliases`).json({ riotId: 'no tag' }).loginAs(admin)
    malformed.assertStatus(422)

    // The status route reads the key's fingerprint, so one has to exist.
    await client.post('/api/admin/riot-key').json({ key: 'RGAPI-test' }).loginAs(admin)
    const status = (await client.get('/api/admin/status').loginAs(admin)).body()
    assert.deepEqual(status.accounts[0].aliases, [{ id: added.body().id, riotId: 'Old Patate#OLD', source: 'manual' }])

    const removed = await client.delete(`/api/admin/aliases/${added.body().id}`).loginAs(admin)
    removed.assertStatus(204)
  })
})
