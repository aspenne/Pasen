import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { readFile } from 'node:fs/promises'
import { DateTime } from 'luxon'

import Match from '#models/match'
import Member from '#models/member'
import RiotAccount from '#models/riot_account'
import { MatchSyncService } from '#ingestion/match_sync_service'
import { RiotClient } from '#riot/client'
import type { RiotRequest, RiotRequester } from '#riot/gateway'
import type { MatchDto } from '#riot/types'

let template: MatchDto

/**
 * Builds distinct matches from one real payload, so shapes stay realistic while
 * ids and timestamps stay under the test's control.
 */
function matchAt(id: string, isoDate: string, puuids: string[]): MatchDto {
  const match = structuredClone(template)
  match.metadata.matchId = id
  match.info.gameCreation = DateTime.fromISO(isoDate, { zone: 'utc' }).toMillis()
  match.metadata.participants = match.metadata.participants.map((p, i) => puuids[i] ?? p)
  match.info.participants.forEach((p, i) => {
    if (puuids[i]) p.puuid = puuids[i]
  })
  return match
}

/** Serves match ids and details, and counts every call that reached Riot. */
function fakeRiot(matches: MatchDto[]) {
  const byId = new Map(matches.map((m) => [m.metadata.matchId, m]))
  const requests: RiotRequest[] = []

  const requester: RiotRequester = {
    async request<T>(request: RiotRequest): Promise<T> {
      requests.push(request)

      if (request.endpoint === 'match-v5.idsByPuuid') {
        const puuid = request.path.split('/')[6]
        const startTime = request.search?.startTime as number | undefined
        const endTime = request.search?.endTime as number | undefined

        const ids = matches
          .filter((m) => m.metadata.participants.includes(puuid))
          .filter((m) => {
            const seconds = m.info.gameCreation / 1000
            return (!startTime || seconds >= startTime) && (!endTime || seconds <= endTime)
          })
          .sort((a, b) => b.info.gameCreation - a.info.gameCreation)
          .map((m) => m.metadata.matchId)

        return ids as T
      }

      const id = request.path.split('/').pop()!
      return byId.get(id) as T
    },
  }

  return {
    client: new RiotClient(requester),
    requests,
    detailFetches: () => requests.filter((r) => r.endpoint === 'match-v5.byId').length,
  }
}

async function makeAccount(puuid: string, overrides: Partial<RiotAccount> = {}) {
  const member = await Member.create({ slug: `m-${puuid}`, displayName: puuid })
  return RiotAccount.create({
    memberId: member.id,
    puuid,
    gameName: puuid,
    tagLine: 'EUW',
    platform: 'euw1',
    backfillState: 'pending',
    ...overrides,
  })
}

test.group('MatchSyncService', (group) => {
  group.setup(async () => {
    const raw = await readFile(new URL('../../fixtures/match_ranked_sr.json', import.meta.url), 'utf8')
    template = JSON.parse(raw) as MatchDto
  })

  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('ingests new matches and records how far it got', async ({ assert }) => {
    const account = await makeAccount('alice')
    const riot = fakeRiot([
      matchAt('EUW1_1', '2026-09-10T10:00:00Z', ['alice']),
      matchAt('EUW1_2', '2026-09-12T10:00:00Z', ['alice']),
    ])

    const outcome = await new MatchSyncService(riot.client).syncRecent(account)

    assert.equal(outcome.ingested, 2)
    assert.lengthOf(await Match.all(), 2)

    await account.refresh()
    assert.equal(account.syncedTo?.toUTC().toISO(), '2026-09-12T10:00:00.000Z')
    assert.equal(account.syncedFrom?.toUTC().toISO(), '2026-09-10T10:00:00.000Z')
  })

  test('never re-fetches a match another member already stored', async ({ assert }) => {
    const shared = matchAt('EUW1_duo', '2026-09-12T10:00:00Z', ['alice', 'bob'])
    const alice = await makeAccount('alice')
    const bob = await makeAccount('bob')

    const first = fakeRiot([shared])
    await new MatchSyncService(first.client).syncRecent(alice)
    assert.equal(first.detailFetches(), 1)

    const second = fakeRiot([shared])
    const outcome = await new MatchSyncService(second.client).syncRecent(bob)

    assert.equal(outcome.alreadyStored, 1)
    assert.equal(outcome.ingested, 0)
    assert.equal(second.detailFetches(), 0, 'a shared game must cost one fetch, not one per member')
  })

  test('an account with nothing new costs a single request', async ({ assert }) => {
    const account = await makeAccount('alice')
    const riot = fakeRiot([matchAt('EUW1_1', '2026-09-10T10:00:00Z', ['alice'])])
    const service = new MatchSyncService(riot.client)

    await service.syncRecent(account)
    const before = riot.requests.length

    await service.syncRecent(account)

    assert.equal(riot.requests.length - before, 1, 'one id listing, no detail fetches')
  })

  test('asks only for matches newer than the last sync', async ({ assert }) => {
    const account = await makeAccount('alice', {
      syncedTo: DateTime.fromISO('2026-09-11T00:00:00Z', { zone: 'utc' }),
    })
    const riot = fakeRiot([
      matchAt('EUW1_old', '2026-09-01T10:00:00Z', ['alice']),
      matchAt('EUW1_new', '2026-09-12T10:00:00Z', ['alice']),
    ])

    const outcome = await new MatchSyncService(riot.client).syncRecent(account)

    assert.equal(outcome.listed, 1)
    assert.isNotNull(await Match.find('EUW1_new'))
    assert.isNull(await Match.find('EUW1_old'))
  })

  test('stays inside its fetch budget so live work can still get through', async ({ assert }) => {
    const account = await makeAccount('alice')
    const riot = fakeRiot(
      Array.from({ length: 10 }, (_, i) =>
        matchAt(`EUW1_${i}`, `2026-09-${String(i + 1).padStart(2, '0')}T10:00:00Z`, ['alice'])
      )
    )

    const outcome = await new MatchSyncService(riot.client).syncRecent(account, { maxFetches: 3 })

    assert.equal(outcome.listed, 10)
    assert.equal(outcome.ingested, 3)
    assert.equal(riot.detailFetches(), 3)
  })

  test('backfill walks backwards and stops at its target', async ({ assert }) => {
    const account = await makeAccount('alice', {
      syncedFrom: DateTime.fromISO('2026-09-10T00:00:00Z', { zone: 'utc' }),
      syncedTo: DateTime.fromISO('2026-09-10T00:00:00Z', { zone: 'utc' }),
      backfillTarget: DateTime.fromISO('2026-09-05T00:00:00Z', { zone: 'utc' }),
    })
    const riot = fakeRiot([
      matchAt('EUW1_inside', '2026-09-07T10:00:00Z', ['alice']),
      matchAt('EUW1_before_target', '2026-09-01T10:00:00Z', ['alice']),
    ])

    const outcome = await new MatchSyncService(riot.client).backfillStep(account)

    assert.equal(outcome.ingested, 1)
    assert.isNotNull(await Match.find('EUW1_inside'))
    assert.isNull(await Match.find('EUW1_before_target'), 'the target is a hard floor')

    await account.refresh()
    assert.equal(account.backfillState, 'done')
  })

  test('a successful step clears the previous failure', async ({ assert }) => {
    const account = await makeAccount('alice', {
      backfillState: 'failed',
      backfillError: 'riot was having a moment',
    })
    const riot = fakeRiot([matchAt('EUW1_1', '2026-09-10T10:00:00Z', ['alice'])])

    await new MatchSyncService(riot.client).backfillStep(account)

    await account.refresh()
    assert.isNull(account.backfillError, 'an error next to a finished backfill reads as broken')
  })

  test('does not call a backfill finished while the page still has matches on it', async ({
    assert,
  }) => {
    const account = await makeAccount('alice')
    // A short page - fewer than Riot's hundred - but more than one step may fetch.
    const riot = fakeRiot(
      Array.from({ length: 10 }, (_, i) =>
        matchAt(`EUW1_${i}`, `2026-09-${String(i + 1).padStart(2, '0')}T10:00:00Z`, ['alice'])
      )
    )
    const service = new MatchSyncService(riot.client)

    const first = await service.backfillStep(account, { maxFetches: 3 })
    assert.equal(first.ingested, 3)
    assert.isFalse(first.complete, 'seven matches on that page were never fetched')

    await account.refresh()
    assert.equal(account.backfillState, 'running')

    // Keep stepping; the walk must eventually reach every one of them.
    for (let step = 0; step < 6; step++) {
      const outcome = await service.backfillStep(account, { maxFetches: 3 })
      if (outcome.complete) break
    }

    assert.lengthOf(await Match.all(), 10, 'nothing may be left behind')
    await account.refresh()
    assert.equal(account.backfillState, 'done')
  })

  test('marks the backfill done when a short page comes back', async ({ assert }) => {
    const account = await makeAccount('alice')
    const riot = fakeRiot([matchAt('EUW1_1', '2026-09-10T10:00:00Z', ['alice'])])

    const outcome = await new MatchSyncService(riot.client).backfillStep(account)

    assert.isTrue(outcome.complete)
    await account.refresh()
    assert.equal(account.backfillState, 'done')
  })

  test('a step that fetched nothing does not rewind the cursor', async ({ assert }) => {
    const account = await makeAccount('alice')
    const riot = fakeRiot([matchAt('EUW1_1', '2026-09-10T10:00:00Z', ['alice'])])
    const service = new MatchSyncService(riot.client)

    await service.syncRecent(account)
    await account.refresh()
    const syncedTo = account.syncedTo

    await service.syncRecent(account)
    await account.refresh()

    assert.equal(account.syncedTo?.toISO(), syncedTo?.toISO())
  })
})
