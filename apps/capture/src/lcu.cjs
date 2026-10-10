'use strict'

const fs = require('node:fs/promises')
const https = require('node:https')
const { execFile } = require('node:child_process')

/**
 * The League client's own local API ("LCU"), which knows the lobby before a
 * game exists - the Live Client API only appears once one has started.
 *
 * It listens on a random port with a random password, both written to a
 * `lockfile` in the install folder and passed to the client process on its
 * command line. Read-only use here: one GET, nothing done in the client.
 * Like the Live Client, it serves a certificate Riot signs itself, so
 * verification is skipped for 127.0.0.1 and nothing else.
 */

function lockfilePaths(platform = process.platform) {
  if (platform === 'win32') {
    return [
      'C:\\Riot Games\\League of Legends\\lockfile',
      'D:\\Riot Games\\League of Legends\\lockfile',
      'C:\\Program Files\\Riot Games\\League of Legends\\lockfile',
    ]
  }
  return ['/Applications/League of Legends.app/Contents/LoL/lockfile']
}

/** "LeagueClient:pid:port:password:https" */
function parseLockfile(text) {
  const parts = String(text).trim().split(':')
  if (parts.length < 5) return null
  const port = Number(parts[2])
  if (!Number.isInteger(port) || !parts[3]) return null
  return { port, password: parts[3], protocol: parts[4] }
}

/** The same two values, as the client process is started with them. */
function credentialsFromCommandLine(text) {
  const port = /--app-port=(\d+)/.exec(text)?.[1]
  const password = /--remote-auth-token=([\w-]+)/.exec(text)?.[1]
  return port && password ? { port: Number(port), password, protocol: 'https' } : null
}

function processCommandLine(platform = process.platform) {
  return new Promise((resolve) => {
    const [command, args] =
      platform === 'win32'
        ? [
            'powershell.exe',
            ['-NoProfile', '-Command', "Get-CimInstance Win32_Process -Filter \"name='LeagueClientUx.exe'\" | Select-Object -ExpandProperty CommandLine"],
          ]
        : ['ps', ['-A', '-o', 'args']]
    execFile(command, args, { timeout: 4000, windowsHide: true }, (error, stdout) => {
      if (error) return resolve('')
      resolve(platform === 'win32' ? stdout : stdout.split('\n').filter((l) => l.includes('LeagueClientUx')).join('\n'))
    })
  })
}

async function readLockfiles(platform = process.platform) {
  for (const path of lockfilePaths(platform)) {
    try {
      const found = parseLockfile(await fs.readFile(path, 'utf8'))
      if (found) return found
    } catch {
      // Not installed there; try the next place.
    }
  }
  return null
}

/** A process scan costs a PowerShell start on Windows; a miss waits this long before the next. */
const SCAN_EVERY_MS = 60_000

/**
 * Where the client listens, remembered between polls. The lockfiles are
 * cheap to read every time; scanning the processes is not, so it runs at
 * most once a minute while the client is closed. What was found is kept
 * until a request with it fails (`forget`), as when the client restarts on
 * a new port.
 */
function credentialSource({
  readLockfiles: read = readLockfiles,
  scanProcess = async () => credentialsFromCommandLine(await processCommandLine()),
  now = Date.now,
} = {}) {
  let known = null
  let lastScan = -Infinity
  return {
    async get() {
      if (known) return known
      known = await read()
      if (!known && now() - lastScan >= SCAN_EVERY_MS) {
        lastScan = now()
        known = await scanProcess()
      }
      return known
    },
    forget() {
      known = null
    },
  }
}

const defaultSource = credentialSource()

function get(url, auth) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      { method: 'GET', timeout: 2500, rejectUnauthorized: false, headers: { authorization: auth, accept: 'application/json' } },
      (response) => {
        let body = ''
        response.on('data', (chunk) => (body += chunk))
        response.on('end', () => {
          let parsed = null
          try {
            parsed = JSON.parse(body)
          } catch {
            parsed = null
          }
          resolve({ status: response.statusCode, body: parsed })
        })
      }
    )
    request.on('timeout', () => request.destroy(new Error('timed out')))
    request.on('error', reject)
    request.end()
  })
}

/**
 * The lobby the player is in, as the client describes it; null when the
 * client is closed, there is no lobby, or anything at all goes wrong - the
 * caller just tries again on its next tick.
 */
async function readLobby({ credentials = () => defaultSource.get(), request = get, forget = () => defaultSource.forget() } = {}) {
  let found = null
  try {
    found = await credentials()
    if (!found) return null
    const auth = `Basic ${Buffer.from(`riot:${found.password}`).toString('base64')}`
    const answer = await request(`https://127.0.0.1:${found.port}/lol-lobby/v2/lobby`, auth)
    return answer.status === 200 ? answer.body : null
  } catch {
    // The client closed or moved to a new port: look for it afresh next time.
    if (found) forget()
    return null
  }
}

module.exports = { lockfilePaths, parseLockfile, credentialsFromCommandLine, credentialSource, readLobby }
