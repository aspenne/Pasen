import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

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

    // Queues and schedulers are registered here from phase 2 onwards. Until
    // they hold the event loop open themselves, the signal wait below does.

    this.logger.info('worker ready')

    await this.#waitForShutdownSignal()

    this.logger.info('worker shutting down')
    await this.terminate()
  }

  /**
   * Resolves on SIGTERM (what `docker compose stop` sends) or SIGINT (Ctrl-C),
   * so the process exits deliberately instead of dying mid-job.
   */
  #waitForShutdownSignal() {
    return new Promise<void>((resolve) => {
      const signals = ['SIGTERM', 'SIGINT'] as const

      // Signal listeners are not ref'd handles, so on their own they do not stop
      // Node from exiting once the event loop drains. This timer is what keeps
      // the process up; drop it once BullMQ workers hold their own connections.
      const keepAlive = setInterval(() => {}, 60_000)

      const onSignal = (signal: NodeJS.Signals) => {
        this.logger.info(`received ${signal}`)
        clearInterval(keepAlive)
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
