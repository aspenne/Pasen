import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import Group from '#models/group'
import Member from '#models/member'
import RiotAccount from '#models/riot_account'
import RiotAccountAlias from '#models/riot_account_alias'
import { RiotIdRefreshService } from '#ingestion/riot_id_refresh_service'
import { RiotClient } from '#riot/client'
import type { RiotRequest, RiotRequester } from '#riot/gateway'

/** Answers account-v1 by puuid from a table; a missing puuid fails like Riot would. */
function fakeRiot(current: Record<string, [string, string]>) {
  const requester: RiotRequester = {
    async request<T>(request: RiotRequest): Promise<T> {
      if (request.endpoint !== 'account-v1.byPuuid') throw new Error(`unexpected call to ${request.endpoint}`)
      const puuid = request.path.split('/').at(-1)!
      const riotId = current[puuid]
      if (!riotId) throw new Error('not found')
      return { puuid, gameName: riotId[0], tagLine: riotId[1] } as T
    },
  }
  return new RiotClient(requester)
}

async function seedAccount(riotId: string, puuid: string) {
  const [gameName, tagLine] = riotId.split('#')
  const group = await Group.firstOrCreate({ slug: 'arigafion' }, { name: 'ARIGAFION' })
  const member = await Member.create({ slug: puuid, displayName: gameName })
  await group.related('members').attach([member.id])
  return RiotAccount.create({ memberId: member.id, puuid, gameName, tagLine, platform: 'euw1', backfillState: 'done' })
}

test.group('RiotIdRefreshService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('follows a rename, and keeps the old Riot ID as an alias', async ({ assert }) => {
    const account = await seedAccount('Patate#CCC', 'p1')
    const report = await new RiotIdRefreshService(fakeRiot({ p1: ['Patate Chaude', 'FR1'] })).refresh()

    await account.refresh()
    assert.equal(account.gameName, 'Patate Chaude')
    assert.equal(account.tagLine, 'FR1')
    assert.deepEqual(report.renamed, [{ accountId: account.id, from: 'Patate#CCC', to: 'Patate Chaude#FR1' }])

    const aliases = await RiotAccountAlias.query().where('riot_account_id', account.id)
    assert.deepEqual(aliases.map((a) => [a.gameName, a.tagLine, a.source]), [['Patate', 'CCC', 'riot']])
  })

  test('leaves an unchanged account alone, and does not duplicate an alias', async ({ assert }) => {
    const account = await seedAccount('Patate#CCC', 'p1')
    const service = new RiotIdRefreshService(fakeRiot({ p1: ['Patate', 'CCC'] }))
    assert.deepEqual((await service.refresh()).renamed, [])

    // Back and forth: the first name is already remembered, so it is not stored twice.
    await new RiotIdRefreshService(fakeRiot({ p1: ['Other', 'EUW'] })).refresh()
    await new RiotIdRefreshService(fakeRiot({ p1: ['Patate', 'CCC'] })).refresh()
    await new RiotIdRefreshService(fakeRiot({ p1: ['Other', 'EUW'] })).refresh()
    const aliases = await RiotAccountAlias.query().where('riot_account_id', account.id).orderBy('id')
    assert.deepEqual(aliases.map((a) => `${a.gameName}#${a.tagLine}`), ['Patate#CCC', 'Other#EUW'])
  })

  test('treats a change of case alone as no rename', async ({ assert }) => {
    await seedAccount('patate#ccc', 'p1')
    const report = await new RiotIdRefreshService(fakeRiot({ p1: ['Patate', 'CCC'] })).refresh()
    assert.lengthOf(report.renamed, 0)
  })

  test('carries on past an account Riot cannot answer for', async ({ assert }) => {
    await seedAccount('Gone#EUW', 'p-gone')
    const ok = await seedAccount('Patate#CCC', 'p1')
    const report = await new RiotIdRefreshService(fakeRiot({ p1: ['Patate', 'NEW'] })).refresh()
    assert.deepEqual(report.failed, ['Gone#EUW'])
    await ok.refresh()
    assert.equal(ok.tagLine, 'NEW')
  })
})
