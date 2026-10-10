'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')

const lcu = require('../src/lcu.cjs')

test('reads the port and password out of the lockfile', () => {
  assert.deepEqual(lcu.parseLockfile('LeagueClient:12345:54321:s3cr3t-Pass:https'), {
    port: 54321,
    password: 's3cr3t-Pass',
    protocol: 'https',
  })
  assert.equal(lcu.parseLockfile('garbage'), null)
})

test('reads them out of the client process when the lockfile is elsewhere', () => {
  const line =
    '"C:/Games/LoL/LeagueClientUx.exe" "--riotclient-auth-token=x" "--app-port=61234" "--remote-auth-token=Ab_Cd-12" "--locale=fr_FR"'
  assert.deepEqual(lcu.credentialsFromCommandLine(line), { port: 61234, password: 'Ab_Cd-12', protocol: 'https' })
  assert.equal(lcu.credentialsFromCommandLine('nothing here'), null)
})

test('knows where League keeps its lockfile on each system', () => {
  assert.ok(lcu.lockfilePaths('win32').some((p) => p.endsWith('League of Legends\\lockfile')))
  assert.ok(lcu.lockfilePaths('darwin').some((p) => p.endsWith('League of Legends.app/Contents/LoL/lockfile')))
})

test('answers null, never throws, when the client is closed or answers badly', async () => {
  assert.equal(await lcu.readLobby({ credentials: async () => null }), null)
  assert.equal(
    await lcu.readLobby({
      credentials: async () => ({ port: 1, password: 'x', protocol: 'https' }),
      request: async () => {
        throw new Error('ECONNREFUSED')
      },
    }),
    null
  )
  assert.equal(
    await lcu.readLobby({
      credentials: async () => ({ port: 1, password: 'x', protocol: 'https' }),
      request: async () => ({ status: 404, body: { message: 'LOBBY_NOT_FOUND' } }),
    }),
    null
  )
})

test('asks for the lobby with the client password', async () => {
  let seen
  const lobby = await lcu.readLobby({
    credentials: async () => ({ port: 54321, password: 'pw', protocol: 'https' }),
    request: async (url, auth) => {
      seen = { url, auth }
      return { status: 200, body: { gameConfig: { isCustom: true } } }
    },
  })
  assert.deepEqual(lobby, { gameConfig: { isCustom: true } })
  assert.equal(seen.url, 'https://127.0.0.1:54321/lol-lobby/v2/lobby')
  assert.equal(seen.auth, `Basic ${Buffer.from('riot:pw').toString('base64')}`)
})

test('keeps the credentials it found, and scans for the client process at most once a minute', async () => {
  let now = 0
  let scans = 0
  let lockfile = null
  const source = lcu.credentialSource({
    readLockfiles: async () => lockfile,
    scanProcess: async () => {
      scans++
      return null
    },
    now: () => now,
  })

  assert.equal(await source.get(), null)
  now += 3000
  assert.equal(await source.get(), null)
  assert.equal(scans, 1, 'a miss is not rescanned three seconds later')
  now += 60_000
  await source.get()
  assert.equal(scans, 2)

  lockfile = { port: 1, password: 'pw', protocol: 'https' }
  assert.deepEqual(await source.get(), lockfile)
  lockfile = null
  assert.deepEqual(await source.get(), { port: 1, password: 'pw', protocol: 'https' }, 'kept until it stops working')
  source.forget()
  now += 60_000
  assert.equal(await source.get(), null)
})
