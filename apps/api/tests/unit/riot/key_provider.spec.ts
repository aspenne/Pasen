import { test } from '@japa/runner'
import redis from '@adonisjs/redis/services/main'
import testUtils from '@adonisjs/core/services/test_utils'

import Setting from '#models/setting'
import { RiotKeyProvider } from '#riot/key_provider'

const CACHE_KEYS = ['riot:key:cache', 'riot:key:invalid_since']

async function freshProvider(envKey?: string) {
  await Setting.query().delete()
  await redis.del(...CACHE_KEYS)
  return new RiotKeyProvider({ connection: redis.connection(), envKey })
}

test.group('RiotKeyProvider', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('falls back to the env key when the database has none', async ({ assert }) => {
    const provider = await freshProvider('RGAPI-from-env')
    assert.equal(await provider.get(), 'RGAPI-from-env')
  })

  test('prefers the database over the env key so /admin wins without a redeploy', async ({
    assert,
  }) => {
    const provider = await freshProvider('RGAPI-from-env')
    await provider.set('RGAPI-from-admin')

    assert.equal(await provider.get(), 'RGAPI-from-admin')
  })

  test('throws when nothing is configured', async ({ assert }) => {
    const provider = await freshProvider(undefined)
    await assert.rejects(() => provider.get(), /No Riot API key configured/)
  })

  test('a rotation is visible to other processes immediately', async ({ assert }) => {
    const admin = await freshProvider()
    const worker = new RiotKeyProvider({ connection: redis.connection() })

    await admin.set('RGAPI-first')
    assert.equal(await worker.get(), 'RGAPI-first')

    await admin.set('RGAPI-second')
    assert.equal(await worker.get(), 'RGAPI-second', 'the cache must not outlive a rotation')
  })

  test('marks the key invalid and clears the flag on rotation', async ({ assert }) => {
    const provider = await freshProvider()
    await provider.set('RGAPI-expired')

    await provider.markInvalid()
    let status = await provider.status()
    assert.isNotNull(status.invalidSince)

    await provider.set('RGAPI-fresh')
    status = await provider.status()
    assert.isNull(status.invalidSince, 'a new key clears the expired banner')
  })

  test('never exposes the key itself in its status', async ({ assert }) => {
    const provider = await freshProvider()
    await provider.set('RGAPI-0123456789-secret-tail')

    const status = await provider.status()
    assert.notInclude(JSON.stringify(status), 'secret-tail')
    assert.equal(status.source, 'database')
    assert.isTrue(status.hasKey)
  })

  test('derives a stable fingerprint that changes with the key', async ({ assert }) => {
    const provider = await freshProvider()

    await provider.set('RGAPI-aaa')
    const first = await provider.fingerprint()
    await provider.set('RGAPI-aaa')
    assert.equal(await provider.fingerprint(), first)

    await provider.set('RGAPI-bbb')
    assert.notEqual(await provider.fingerprint(), first)
  })
})
