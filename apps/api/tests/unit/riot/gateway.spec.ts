import { test } from '@japa/runner'
import redis from '@adonisjs/redis/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import { randomUUID } from 'node:crypto'

import Setting from '#models/setting'
import { RiotGateway } from '#riot/gateway'
import { RiotKeyProvider } from '#riot/key_provider'

type Reply = { status: number; body?: unknown; headers?: Record<string, string> }

/** Sleeping advances virtual time, so retry paths cost the suite nothing. */
function virtualClock(start = 1_700_000_000_000) {
  let current = start
  const slept: number[] = []

  return {
    slept,
    elapsed: () => current - start,
    now: () => current,
    sleep: async (ms: number) => {
      slept.push(ms)
      current += ms
    },
  }
}

/** Queues canned replies and records what the gateway actually sent. */
function stubFetch(replies: Reply[]) {
  const calls: { url: string; headers: Record<string, string> }[] = []

  const impl = async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string> })
    const reply = replies.shift() ?? { status: 500 }

    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'content-type': 'application/json', ...reply.headers },
    })
  }

  return { impl: impl as unknown as typeof fetch, calls }
}

async function buildGateway(replies: Reply[], key = 'RGAPI-test-key') {
  await Setting.query().delete()
  await redis.del('riot:key:cache')

  const keyProvider = new RiotKeyProvider({ connection: redis.connection() })
  await keyProvider.set(key)

  const fetch = stubFetch(replies)
  const clock = virtualClock()
  const gateway = new RiotGateway({
    keyProvider,
    connection: redis.connection(),
    windows: [{ limit: 1000, seconds: 1 }],
    prefix: `t:${randomUUID()}`,
    fetch: fetch.impl,
    now: clock.now,
    sleep: clock.sleep,
  })

  return { gateway, fetch, clock }
}

test.group('RiotGateway', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('authenticates with the key header and never puts it in the url', async ({ assert }) => {
    const { gateway, fetch } = await buildGateway([{ status: 200, body: { puuid: 'abc' } }])

    await gateway.request({
      host: { kind: 'platform', platform: 'euw1' },
      path: '/lol/summoner/v4/summoners/by-puuid/abc',
      endpoint: 'summoner-v4.byPuuid',
    })

    assert.equal(fetch.calls[0].headers['X-Riot-Token'], 'RGAPI-test-key')
    assert.notInclude(fetch.calls[0].url, 'RGAPI')
  })

  test('routes match-v5 to the regional cluster and summoner-v4 to the platform', async ({
    assert,
  }) => {
    const { gateway, fetch } = await buildGateway([
      { status: 200, body: [] },
      { status: 200, body: {} },
    ])

    await gateway.request({
      host: { kind: 'match', platform: 'euw1' },
      path: '/lol/match/v5/matches/by-puuid/abc/ids',
      endpoint: 'match-v5.ids',
    })
    await gateway.request({
      host: { kind: 'platform', platform: 'euw1' },
      path: '/lol/spectator/v5/active-games/by-summoner/abc',
      endpoint: 'spectator-v5.active',
    })

    assert.include(fetch.calls[0].url, 'https://europe.api.riotgames.com/')
    assert.include(fetch.calls[1].url, 'https://euw1.api.riotgames.com/')
  })

  test('drops undefined query params instead of sending the string "undefined"', async ({
    assert,
  }) => {
    const { gateway, fetch } = await buildGateway([{ status: 200, body: [] }])

    await gateway.request({
      host: { kind: 'match', platform: 'euw1' },
      path: '/lol/match/v5/matches/by-puuid/abc/ids',
      endpoint: 'match-v5.ids',
      search: { start: 0, count: 100, startTime: undefined },
    })

    assert.include(fetch.calls[0].url, 'start=0&count=100')
    assert.notInclude(fetch.calls[0].url, 'startTime')
  })

  test('turns 404 into a typed error callers can treat as "not in a game"', async ({ assert }) => {
    const { gateway } = await buildGateway([{ status: 404 }])

    await assert.rejects(
      () =>
        gateway.request({
          host: { kind: 'platform', platform: 'euw1' },
          path: '/lol/spectator/v5/active-games/by-summoner/abc',
          endpoint: 'spectator-v5.active',
        }),
      /Riot returned 404/
    )
  })

  test('flags the key as dead on 403 and does not retry', async ({ assert }) => {
    const { gateway, fetch } = await buildGateway([{ status: 403 }])

    await assert.rejects(
      () =>
        gateway.request({
          host: { kind: 'platform', platform: 'euw1' },
          path: '/lol/summoner/v4/summoners/by-puuid/abc',
          endpoint: 'summoner-v4.byPuuid',
        }),
      /rejected the API key \(403\)/
    )

    assert.lengthOf(fetch.calls, 1, 'an expired key will not fix itself on a retry')

    const status = await new RiotKeyProvider({ connection: redis.connection() }).status()
    assert.isNotNull(status.invalidSince)
  })

  test('waits out retry-after on 429, then succeeds', async ({ assert }) => {
    const { gateway, fetch, clock } = await buildGateway([
      { status: 429, headers: { 'retry-after': '2' } },
      { status: 200, body: { ok: true } },
    ])

    const result = await gateway.request<{ ok: boolean }>({
      host: { kind: 'match', platform: 'euw1' },
      path: '/lol/match/v5/matches/EUW1_1',
      endpoint: 'match-v5.byId',
    })

    assert.isTrue(result.ok)
    assert.lengthOf(fetch.calls, 2)
    // The wait goes through the shared limiter as a penalty, so it holds back
    // every process, not just this call.
    assert.isAtLeast(clock.elapsed(), 2_000, "Riot's Retry-After must be honoured in full")
  })

  test('gives up after repeated rate limiting', async ({ assert }) => {
    const { gateway, fetch } = await buildGateway([
      { status: 429, headers: { 'retry-after': '1' } },
      { status: 429, headers: { 'retry-after': '1' } },
      { status: 429, headers: { 'retry-after': '1' } },
      { status: 429, headers: { 'retry-after': '1' } },
    ])

    await assert.rejects(
      () =>
        gateway.request({
          host: { kind: 'match', platform: 'euw1' },
          path: '/lol/match/v5/matches/EUW1_1',
          endpoint: 'match-v5.byId',
        }),
      /rate limited/
    )

    assert.lengthOf(fetch.calls, 3, 'bounded retries, not an infinite loop')
  })

  test('retries a 503 and then gives up as unavailable', async ({ assert }) => {
    const recovered = await buildGateway([{ status: 503 }, { status: 200, body: { ok: true } }])
    const result = await recovered.gateway.request<{ ok: boolean }>({
      host: { kind: 'match', platform: 'euw1' },
      path: '/lol/match/v5/matches/EUW1_1',
      endpoint: 'match-v5.byId',
    })
    assert.isTrue(result.ok)

    const down = await buildGateway([{ status: 503 }, { status: 503 }, { status: 503 }])
    await assert.rejects(
      () =>
        down.gateway.request({
          host: { kind: 'match', platform: 'euw1' },
          path: '/lol/match/v5/matches/EUW1_1',
          endpoint: 'match-v5.byId',
        }),
      /unavailable \(503\)/
    )
  })

  test('does not retry a 400, which will fail the same way every time', async ({ assert }) => {
    const { gateway, fetch } = await buildGateway([{ status: 400 }])

    await assert.rejects(() =>
      gateway.request({
        host: { kind: 'match', platform: 'euw1' },
        path: '/lol/match/v5/matches/nonsense',
        endpoint: 'match-v5.byId',
      })
    )

    assert.lengthOf(fetch.calls, 1)
  })

  test('charges the shared budget for every call that goes out', async ({ assert }) => {
    const { gateway } = await buildGateway([
      { status: 200, body: {} },
      { status: 200, body: {} },
    ])

    for (let i = 0; i < 2; i++) {
      await gateway.request({
        host: { kind: 'match', platform: 'euw1' },
        path: '/lol/match/v5/matches/EUW1_1',
        endpoint: 'match-v5.byId',
      })
    }

    const limiter = await gateway.limiter()
    const [window] = await limiter.snapshot()
    assert.equal(window.used, 2)
  })
})
