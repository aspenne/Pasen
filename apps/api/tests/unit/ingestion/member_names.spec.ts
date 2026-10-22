import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import Member from '#models/member'
import RiotAccount from '#models/riot_account'
import { syncMemberNames } from '#ingestion/member_names'

async function member(slug: string, displayName: string, accounts: [string, string][]) {
  const row = await Member.create({ slug, displayName })
  for (const [gameName, tagLine] of accounts) {
    await RiotAccount.create({ memberId: row.id, puuid: `${slug}-${gameName}`, gameName, tagLine, platform: 'euw1', backfillState: 'done' })
  }
  return row
}

test.group('syncMemberNames', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test("names each member after their first account's in-game name, without the tag", async ({ assert }) => {
    const patate = await member('patate', 'Patate', [['3C Patate Chaude', 'CCC'], ['Smurf', 'EUW']])
    const noah = await member('noah', 'Nøah', [['Nøah', 'SHEN']])
    const nobody = await member('ghost', 'Ghost', [])

    const changed = await syncMemberNames()

    await Promise.all([patate.refresh(), noah.refresh(), nobody.refresh()])
    assert.equal(patate.displayName, '3C Patate Chaude')
    assert.equal(noah.displayName, 'Nøah')
    // No account, nothing to take a name from: left as it was.
    assert.equal(nobody.displayName, 'Ghost')
    assert.deepEqual(changed, [{ slug: 'patate', from: 'Patate', to: '3C Patate Chaude' }])
  })

  test('only touches the members it is given', async ({ assert }) => {
    const a = await member('a', 'Old A', [['New A', 'EUW']])
    const b = await member('b', 'Old B', [['New B', 'EUW']])
    await syncMemberNames([a.id])
    await Promise.all([a.refresh(), b.refresh()])
    assert.equal(a.displayName, 'New A')
    assert.equal(b.displayName, 'Old B')
  })

  test('follows the main account when one is chosen', async ({ assert }) => {
    const patate = await member('patate', 'Whatever', [['Aspenne', 'EUW'], ['3C Patate Chaude', 'CCC']])
    const main = await RiotAccount.findByOrFail('game_name', '3C Patate Chaude')
    patate.mainAccountId = main.id
    await patate.save()

    await syncMemberNames([patate.id])
    await patate.refresh()
    assert.equal(patate.displayName, '3C Patate Chaude')
  })
})
