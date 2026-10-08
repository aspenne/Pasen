'use strict'

const { EventEmitter } = require('node:events')
const https = require('node:https')

/**
 * Watches the League client's Live Client Data API and hands over each game
 * the moment it ends.
 *
 * The same logic as the command-line agent, with one difference that matters
 * for an app: it does not stop after the first game. It goes back to waiting,
 * so it can sit in the tray all evening and catch every custom.
 *
 * The client serves https://127.0.0.1:2999 only while a game window is open,
 * with a certificate Riot signs itself. Verification is skipped for that one
 * address and nothing else.
 */
const ENDPOINT = 'https://127.0.0.1:2999/liveclientdata/allgamedata'
const POLL_MS = 5000

function fetchSnapshot(url = ENDPOINT) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      { method: 'GET', timeout: 4000, rejectUnauthorized: false },
      (response) => {
        let body = ''
        response.on('data', (chunk) => (body += chunk))
        response.on('end', () => {
          if (response.statusCode !== 200) return reject(new Error(`HTTP ${response.statusCode}`))
          try {
            resolve(JSON.parse(body))
          } catch (error) {
            reject(error)
          }
        })
      }
    )
    request.on('timeout', () => request.destroy(new Error('timed out')))
    request.on('error', reject)
    request.end()
  })
}

/** The bits of a snapshot the window shows while a game runs. */
function summarise(snapshot) {
  const players = snapshot?.allPlayers ?? []
  const me = players.find((player) => player.riotId === snapshot?.activePlayer?.riotId)
  const end = (snapshot?.events?.Events ?? []).find((event) => event.EventName === 'GameEnd')
  const bots = players.filter((player) => player.isBot).length

  return {
    gameMode: snapshot?.gameData?.gameMode ?? 'UNKNOWN',
    gameTime: Math.round(snapshot?.gameData?.gameTime ?? 0),
    players: players.length,
    humans: players.length - bots,
    me: me
      ? {
          riotId: me.riotId,
          champion: me.championName,
          team: me.team,
          kills: me.scores?.kills ?? 0,
          deaths: me.scores?.deaths ?? 0,
          assists: me.scores?.assists ?? 0,
        }
      : null,
    /** "Win" or "Lose", from the seat of whoever is playing on this PC; null if unseen. */
    result: end?.Result ?? null,
  }
}

function endedIn(snapshot) {
  return (snapshot?.events?.Events ?? []).some((event) => event.EventName === 'GameEnd')
}

/**
 * Tells one game from the next: the lobby's champions plus the moment it
 * ended (or the clock, when it was cut short). Two customs back to back with
 * the same picks still differ by when they finished.
 */
function keyOf(snapshot) {
  const champions = (snapshot?.allPlayers ?? []).map((player) => player.championName).join(',')
  const end = (snapshot?.events?.Events ?? []).find((event) => event.EventName === 'GameEnd')
  return `${champions}|${end?.EventTime ?? snapshot?.gameData?.gameTime ?? ''}`
}

/**
 * Events: `status` ({ state: 'waiting' } or { state: 'playing', summary }),
 * and `ended` ({ snapshot, summary, reason }).
 */
class Watcher extends EventEmitter {
  constructor({ fetch = fetchSnapshot, pollMs = POLL_MS } = {}) {
    super()
    this.fetch = fetch
    this.pollMs = pollMs
    this.last = null
    this.timer = null
    this.stopped = true
  }

  start() {
    if (!this.stopped) return
    this.stopped = false
    this.emit('status', { state: 'waiting' })
    this.#tick()
  }

  stop() {
    this.stopped = true
    clearTimeout(this.timer)
  }

  async #tick() {
    if (this.stopped) return

    let snapshot = null
    try {
      snapshot = await this.fetch()
    } catch {
      // The window closed. If a game was running, it just ended.
      if (this.last) this.#finish(this.last, 'the game window closed')
    }

    if (snapshot) {
      if (endedIn(snapshot) && keyOf(snapshot) === this.handed) {
        // A finished game lingers on the endpoint until its window closes.
        this.last = null
      } else {
        this.last = snapshot
        this.emit('status', { state: 'playing', summary: summarise(snapshot) })
        if (endedIn(snapshot)) this.#finish(snapshot, 'GameEnd')
      }
    }

    if (!this.stopped) this.timer = setTimeout(() => this.#tick(), this.pollMs)
  }

  #finish(snapshot, reason) {
    this.last = null
    this.handed = keyOf(snapshot)

    this.emit('ended', { snapshot, summary: summarise(snapshot), reason })
    this.emit('status', { state: 'waiting' })
  }
}

module.exports = { Watcher, summarise, fetchSnapshot, keyOf }
