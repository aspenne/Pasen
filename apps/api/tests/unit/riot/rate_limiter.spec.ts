import { test } from '@japa/runner'
import redis from '@adonisjs/redis/services/main'
import { randomUUID } from 'node:crypto'

import { RiotRateLimiter } from '#riot/rate_limiter'

function limiter(windows: { limit: number; seconds: number }[], prefix = `t:${randomUUID()}`) {
  return new RiotRateLimiter({ connection: redis.connection(), windows, prefix })
}

test.group('RiotRateLimiter', () => {
  test('grants requests up to the window limit', async ({ assert }) => {
    const rl = limiter([{ limit: 3, seconds: 1 }])
    const now = 10_000

    assert.equal(await rl.tryAcquire(now), 0)
    assert.equal(await rl.tryAcquire(now), 0)
    assert.equal(await rl.tryAcquire(now), 0)
  })

  test('denies once the window is full and reports the wait to the window end', async ({
    assert,
  }) => {
    const rl = limiter([{ limit: 2, seconds: 1 }])
    const now = 10_250

    await rl.tryAcquire(now)
    await rl.tryAcquire(now)

    // Windows are aligned to the epoch, so the one holding 10_250 ends at 11_000.
    assert.equal(await rl.tryAcquire(now), 750)
  })

  test('refills in the next window', async ({ assert }) => {
    const rl = limiter([{ limit: 1, seconds: 1 }])

    assert.equal(await rl.tryAcquire(10_000), 0)
    assert.isAbove(await rl.tryAcquire(10_500), 0)
    assert.equal(await rl.tryAcquire(11_000), 0)
  })

  test('enforces the tightest of several windows', async ({ assert }) => {
    // Riot applies both limits at once: 2 per second and 3 per two seconds.
    const rl = limiter([
      { limit: 2, seconds: 1 },
      { limit: 3, seconds: 2 },
    ])

    assert.equal(await rl.tryAcquire(10_000), 0)
    assert.equal(await rl.tryAcquire(10_000), 0)
    // Per-second window is full even though the two-second one has room.
    assert.equal(await rl.tryAcquire(10_000), 1_000)

    // Next second: the two-second window now becomes the binding constraint.
    assert.equal(await rl.tryAcquire(11_000), 0)
    assert.equal(await rl.tryAcquire(11_000), 1_000)
  })

  test('never charges a window when another window denies the request', async ({ assert }) => {
    const rl = limiter([
      { limit: 1, seconds: 1 },
      { limit: 10, seconds: 60 },
    ])

    await rl.tryAcquire(10_000)
    await rl.tryAcquire(10_100) // denied by the 1s window
    await rl.tryAcquire(10_200) // denied by the 1s window

    const [, minute] = await rl.snapshot(10_200)
    assert.equal(minute.used, 1, 'denied attempts must not consume the longer window')
  })

  test('shares its budget across instances, as separate processes do', async ({ assert }) => {
    const prefix = `t:${randomUUID()}`
    const api = limiter([{ limit: 2, seconds: 1 }], prefix)
    const worker = limiter([{ limit: 2, seconds: 1 }], prefix)

    assert.equal(await api.tryAcquire(10_000), 0)
    assert.equal(await worker.tryAcquire(10_000), 0)
    assert.isAbove(await worker.tryAcquire(10_000), 0, 'the budget is per key, not per process')
  })

  test('blocks every window while a 429 penalty is active', async ({ assert }) => {
    const rl = limiter([{ limit: 100, seconds: 1 }])

    await rl.penalize(5_000, 10_000)

    assert.equal(await rl.tryAcquire(10_000), 5_000)
    assert.equal(await rl.tryAcquire(12_000), 3_000)
    assert.equal(await rl.tryAcquire(15_000), 0)
  })

  test('acquire resolves once capacity frees up', async ({ assert }) => {
    const rl = limiter([{ limit: 1, seconds: 1 }])

    await rl.acquire()
    const startedAt = Date.now()
    await rl.acquire()

    assert.isBelow(Date.now() - startedAt, 2_000)
  }).timeout(5_000)

  test('acquire gives up rather than waiting forever', async ({ assert }) => {
    const rl = limiter([{ limit: 1, seconds: 60 }])
    await rl.acquire()

    await assert.rejects(() => rl.acquire({ maxWaitMs: 100 }), /exceeds the 100ms budget/)
  })
})
