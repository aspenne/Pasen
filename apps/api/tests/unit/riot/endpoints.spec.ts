import { test } from '@japa/runner'

import { RiotClient } from '#riot/client'
import { RiotNotFoundError } from '#riot/errors'
import type { RiotRequest, RiotRequester } from '#riot/gateway'

/** Records what the endpoints asked for and replays a canned answer. */
function fakeGateway(reply: unknown | (() => unknown)) {
  const requests: RiotRequest[] = []

  const requester: RiotRequester = {
    async request<T>(request: RiotRequest): Promise<T> {
      requests.push(request)
      const value = typeof reply === 'function' ? (reply as () => unknown)() : reply
      return value as T
    },
  }

  return { client: new RiotClient(requester), requests }
}

test.group('Riot endpoints', () => {
  test('encodes riot ids that contain spaces and tags', async ({ assert }) => {
    const { client, requests } = fakeGateway({ puuid: 'p', gameName: 'x', tagLine: 'y' })

    await client.account.byRiotId('3C Patate Chaude', 'CCC', 'euw1')

    assert.equal(
      requests[0].path,
      '/riot/account/v1/accounts/by-riot-id/3C%20Patate%20Chaude/CCC'
    )
    assert.deepEqual(requests[0].host, { kind: 'account', platform: 'euw1' })
  })

  test('reads ranked standing by puuid, not by the removed summoner id', async ({ assert }) => {
    const { client, requests } = fakeGateway([])

    await client.league.entriesByPuuid('puuid-1', 'euw1')

    assert.include(requests[0].path, '/lol/league/v4/entries/by-puuid/puuid-1')
    assert.notInclude(requests[0].path, 'by-summoner')
  })

  test('clamps a match id page to the 100 Riot will return', async ({ assert }) => {
    const { client, requests } = fakeGateway([])

    await client.match.idsByPuuid('puuid-1', 'euw1', { count: 500 })

    assert.equal(requests[0].search?.count, 100)
  })

  test('routes match history to the regional cluster', async ({ assert }) => {
    const { client, requests } = fakeGateway([])

    await client.match.idsByPuuid('puuid-1', 'euw1')

    assert.deepEqual(requests[0].host, { kind: 'match', platform: 'euw1' })
  })

  test('treats a spectator 404 as "not in a game" rather than an error', async ({ assert }) => {
    const { client } = fakeGateway(() => {
      throw new RiotNotFoundError('spectator-v5.activeGame')
    })

    assert.isNull(await client.spectator.activeGameByPuuid('puuid-1', 'euw1'))
  })

  test('still propagates a real spectator failure', async ({ assert }) => {
    const { client } = fakeGateway(() => {
      throw new Error('connection reset')
    })

    await assert.rejects(
      () => client.spectator.activeGameByPuuid('puuid-1', 'euw1'),
      /connection reset/
    )
  })
})
