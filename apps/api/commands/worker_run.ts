import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

import { closeQueues } from '#queues/main'
import { startWorkers, stopWorkers } from '#queues/worker'

/**
 * Long-running process that owns every background job: Riot polling, match
 * ingestion, backfill. It is deliberately a separate process from the HTTP
 * server so a slow backfill can never make a page request wait, and so the two
 * can be scaled independently.
 */
export default class WorkerRun extends BaseCommand {
  static commandName = 'worker:run'
  static description = 'Run the background job worker (Riot polling, ingestion, backfill)'

  static options: CommandOptions = {
    startApp: true,
    staysAlive: true,
  }

  async run() {
    this.logger.info('worker starting')

    const workers = await startWorkers()

    this.logger.info(`worker ready, listening on ${workers.map((w) => w.name).join(', ')}`)

    await this.#waitForShutdownSignal()

    this.logger.info('worker shutting down')
    // Close the workers first so an in-flight job finishes before the queues
    // they would write follow-up jobs to disappear.
    await stopWorkers(workers)
    await closeQueues()
    await this.terminate()
  }

  /**
   * Resolves on SIGTERM (what `docker compose stop` sends) or SIGINT (Ctrl-C),
   * so the process exits deliberately instead of dying mid-job. The BullMQ
   * workers hold the event loop open in the meantime.
   */
  #waitForShutdownSignal() {
    return new Promise<void>((resolve) => {
      const signals = ['SIGTERM', 'SIGINT'] as const

      const onSignal = (signal: NodeJS.Signals) => {
        this.logger.info(`received ${signal}`)
        for (const each of signals) {
          process.removeListener(each, onSignal)
        }
        resolve()
      }

      for (const signal of signals) {
        process.on(signal, onSignal)
      }
    })
  }
}
