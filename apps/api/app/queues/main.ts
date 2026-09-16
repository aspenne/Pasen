import { Queue } from 'bullmq'
import type { ConnectionOptions } from 'bullmq'

import env from '#start/env'

export const QUEUE_NAMES = ['live', 'recent', 'backfill'] as const
export type QueueName = (typeof QUEUE_NAMES)[number]

/**
 * BullMQ needs a connection it controls: it blocks on BRPOPLPUSH, which requires
 * maxRetriesPerRequest to be null, a setting the application's own Redis client
 * must not have.
 */
export function connectionOptions(): ConnectionOptions {
  return {
    host: env.get('REDIS_HOST'),
    port: env.get('REDIS_PORT'),
    password: env.get('REDIS_PASSWORD') || undefined,
    db: env.get('REDIS_DB'),
    maxRetriesPerRequest: null,
  }
}

const queues = new Map<QueueName, Queue>()

export function queue(name: QueueName): Queue {
  let existing = queues.get(name)

  if (!existing) {
    existing = new Queue(name, {
      connection: connectionOptions(),
      defaultJobOptions: {
        // Keep enough history to explain a bad night, not enough to fill Redis.
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
      },
    })
    queues.set(name, existing)
  }

  return existing
}

export async function closeQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((q) => q.close()))
  queues.clear()
}
