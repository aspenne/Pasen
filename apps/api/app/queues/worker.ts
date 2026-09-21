import { Worker } from 'bullmq'
import logger from '@adonisjs/core/services/logger'

import { JOBS } from '#queues/jobs'
import { connectionOptions, queue, QUEUE_NAMES } from '#queues/main'
import {
  processBackfillStep,
  processLive,
  processRankSnapshot,
  processRecentSync,
  processRecentSyncAccount,
  processStaticSync,
  processPuuidRekey,
} from '#queues/processors'

/**
 * Schedules. Every one of these competes for the same Riot budget, so the
 * intervals are chosen to leave headroom rather than to be as fresh as possible:
 * fifteen accounts polled once a minute is fifteen requests, against ninety-five
 * per two minutes.
 */
const SCHEDULE = [
  { queue: 'live', name: JOBS.livePoll, every: 60_000 },
  { queue: 'recent', name: JOBS.recentSync, every: 180_000 },
  { queue: 'recent', name: JOBS.rankSnapshot, every: 3_600_000 },
  { queue: 'backfill', name: JOBS.backfillStep, every: 60_000 },
  { queue: 'backfill', name: JOBS.staticSync, every: 86_400_000 },
] as const

const HANDLERS: Record<string, (job: any) => Promise<void>> = {
  [JOBS.livePoll]: processLive,
  [JOBS.recentSync]: processRecentSync,
  [JOBS.recentSyncAccount]: processRecentSyncAccount,
  [JOBS.rankSnapshot]: processRankSnapshot,
  [JOBS.backfillStep]: processBackfillStep,
  [JOBS.staticSync]: processStaticSync,
  [JOBS.puuidRekey]: processPuuidRekey,
}

export async function startWorkers(): Promise<Worker[]> {
  for (const entry of SCHEDULE) {
    await queue(entry.queue).upsertJobScheduler(
      entry.name,
      { every: entry.every },
      { name: entry.name }
    )
  }

  return QUEUE_NAMES.map((name) => {
    const worker = new Worker(
      name,
      async (job) => {
        const handler = HANDLERS[job.name]
        if (!handler) {
          throw new Error(`No handler registered for job "${job.name}"`)
        }
        await handler(job)
      },
      {
        connection: connectionOptions(),
        /*
         * One job at a time per queue. Concurrency would not buy throughput
         * anyway - every job blocks on the same Riot rate limit - and it would
         * make a backfill and a live poll fight over it.
         */
        concurrency: 1,
      }
    )

    worker.on('failed', (job, error) => {
      logger.error({ queue: name, job: job?.name, err: error.message }, 'job failed')
    })

    return worker
  })
}

export async function stopWorkers(workers: Worker[]): Promise<void> {
  await Promise.all(workers.map((worker) => worker.close()))
}
