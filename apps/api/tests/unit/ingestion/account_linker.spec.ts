import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import Member from '#models/member'
import RiotAccount from '#models/riot_account'
import { AccountLinker } from '#ingestion/account_linker'
import { RiotClient } from '#riot/client'
import type { RiotRequest, RiotRequester } from '#riot/gateway'

/** Answers account-v1 and summoner-v4 for a fixed identity. */
function fakeRiot(identity: { puuid: string; gameName: string; tagLine: string }) {
  const requester: RiotRequester = {
    async request<T>(request: RiotRequest): Promise<T> {
      if (request.endpoint.startsWith('account-v1')) {
        return identity as T
      }
      return { puuid: identity.puuid, profileIconId: 1, summonerLevel: 42, revisionDate: 0 } as T
    },
  }
  return new RiotClient(requester)
}

const IDENTITY = { puuid: 'puuid-1', gameName: '3C Patate Chaude', tagLine: 'CCC' }

test.group('AccountLinker', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('creates a member named after the riot id when none is given', async ({ assert }) => {
    const account = await new AccountLinker(fakeRiot(IDENTITY)).link({
      gameName: IDENTITY.gameName,
      tagLine: IDENTITY.tagLine,
      platform: 'euw1',
    })

    const member = await Member.findOrFail(account.memberId)
    assert.equal(member.displayName, '3C Patate Chaude')
    assert.equal(account.summonerLevel, 42)
  })

  test('uses the nickname when one is given', async ({ assert }) => {
    const account = await new AccountLinker(fakeRiot(IDENTITY)).link({
      gameName: IDENTITY.gameName,
      tagLine: IDENTITY.tagLine,
      platform: 'euw1',
      memberName: 'Patate',
    })

    const member = await Member.findOrFail(account.memberId)
    assert.equal(member.slug, 'patate')
  })

  test('re-adding an account keeps its member instead of splitting the person in two', async ({
    assert,
  }) => {
    const linker = new AccountLinker(fakeRiot(IDENTITY))

    const first = await linker.link({
      gameName: IDENTITY.gameName,
      tagLine: IDENTITY.tagLine,
      platform: 'euw1',
      memberName: 'Patate',
    })

    // Running the add command a second time without the nickname must not
    // invent a second member and leave the first with no accounts.
    const second = await linker.link({
      gameName: IDENTITY.gameName,
      tagLine: IDENTITY.tagLine,
      platform: 'euw1',
    })

    assert.equal(second.id, first.id)
    assert.equal(second.memberId, first.memberId)
    assert.lengthOf(await Member.all(), 1)
    assert.lengthOf(await RiotAccount.all(), 1)
  })

  test('an explicit member still moves the account, which is a correction', async ({ assert }) => {
    const linker = new AccountLinker(fakeRiot(IDENTITY))
    await linker.link({
      gameName: IDENTITY.gameName,
      tagLine: IDENTITY.tagLine,
      platform: 'euw1',
      memberName: 'Patate',
    })

    const other = await Member.create({ slug: 'someone-else', displayName: 'Someone Else' })
    const moved = await linker.link({
      gameName: IDENTITY.gameName,
      tagLine: IDENTITY.tagLine,
      platform: 'euw1',
      memberId: other.id,
    })

    assert.equal(moved.memberId, other.id)
  })

  test('a second account joins the same member rather than duplicating them', async ({
    assert,
  }) => {
    const linker = new AccountLinker(fakeRiot(IDENTITY))
    const main = await linker.link({
      gameName: IDENTITY.gameName,
      tagLine: IDENTITY.tagLine,
      platform: 'euw1',
      memberName: 'Patate',
    })

    const smurf = await new AccountLinker(
      fakeRiot({ puuid: 'puuid-2', gameName: 'Smurf', tagLine: 'EUW' })
    ).link({
      gameName: 'Smurf',
      tagLine: 'EUW',
      platform: 'euw1',
      memberId: main.memberId,
    })

    assert.equal(smurf.memberId, main.memberId)
    assert.lengthOf(await RiotAccount.query().where('member_id', main.memberId), 2)
  })

  test('adopts riot\'s casing over whatever was typed', async ({ assert }) => {
    const account = await new AccountLinker(fakeRiot(IDENTITY)).link({
      gameName: '3c patate chaude',
      tagLine: 'ccc',
      platform: 'euw1',
    })

    assert.equal(account.riotId, '3C Patate Chaude#CCC')
  })
})
