#!/usr/bin/env node
/**
 * Captures a custom game from the League client, which is the only place it
 * exists: Riot's match API does not serve customs, and the client's own Live
 * Client Data API is gone the moment the game window closes.
 *
 * So this watches https://127.0.0.1:2999 while a game runs, keeps the most
 * recent answer, and saves it the instant the game ends - whether it learns
 * that from a GameEnd event or from the endpoint simply going away.
 *
 * No dependencies, so it runs anywhere Node does with nothing to install.
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { request as httpsRequest } from 'node:https'
import { join } from 'node:path'

const ENDPOINT = 'https://127.0.0.1:2999/liveclientdata/allgamedata'
const POLL_MS = 5_000
/** The client's certificate is self-signed by Riot, and only ever on loopback. */
const TLS = { rejectUnauthorized: false }

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, { ...TLS, method: 'GET', timeout: 4_000 }, (res) => {
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
        try {
          resolve(JSON.parse(body))
        } catch (error) {
          reject(error)
        }
      })
    })

    req.on('timeout', () => req.destroy(new Error('timed out')))
    req.on('error', reject)
    req.end()
  })
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function endedIn(snapshot) {
  const events = snapshot?.events?.Events ?? []
  return events.some((event) => event.EventName === 'GameEnd')
}

function describe(snapshot) {
  const players = snapshot?.allPlayers ?? []
  const mode = snapshot?.gameData?.gameMode ?? 'unknown'
  const clock = Math.round(snapshot?.gameData?.gameTime ?? 0)
  const minutes = String(Math.floor(clock / 60)).padStart(2, '0')
  const seconds = String(clock % 60).padStart(2, '0')
  return `${mode}, ${players.length} players, ${minutes}:${seconds}`
}

async function save(snapshot, reason) {
  const directory = join(process.cwd(), 'captures')
  await mkdir(directory, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file = join(directory, `custom-${stamp}.json`)
  await writeFile(file, JSON.stringify(snapshot, null, 2), 'utf8')

  console.log(`\nSaved (${reason}): ${file}`)
  console.log(describe(snapshot))
  return file
}

async function main() {
  console.log('Watching for a game on 127.0.0.1:2999. Start your custom, then play.')
  console.log('Leave this running; it saves by itself when the game ends. Ctrl-C to stop.\n')

  let last = null
  let sawGame = false

  for (;;) {
    let snapshot = null
    try {
      snapshot = await getJson(ENDPOINT)
    } catch {
      /*
       * Before a game this just means "not started". After one it means the
       * window is gone and the data with it - which is exactly the moment the
       * snapshot we are holding becomes the only copy that exists.
       */
      if (sawGame && last) {
        await save(last, 'the game closed')
        return
      }
      await sleep(POLL_MS)
      continue
    }

    if (!sawGame) {
      sawGame = true
      console.log(`Game found: ${describe(snapshot)}`)
    }

    last = snapshot
    process.stdout.write(`\r${describe(snapshot)}   `)

    // The surest moment: the client itself says the game is over.
    if (endedIn(snapshot)) {
      await save(snapshot, 'GameEnd event')
      return
    }

    await sleep(POLL_MS)
  }
}

main().catch((error) => {
  console.error('\nAgent stopped:', error.message)
  process.exitCode = 1
})
