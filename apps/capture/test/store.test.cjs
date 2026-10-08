'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { Store } = require('../src/store.cjs')

/** Stands in for Electron's safeStorage: reversible, and visibly not plain text. */
const fakeKeychain = {
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from([...value].reverse().join('')),
  decryptString: (buffer) => [...buffer.toString()].reverse().join(''),
}

function fresh() {
  return new Store(fs.mkdtempSync(path.join(os.tmpdir(), 'pasen-capture-')), fakeKeychain)
}

test('keeps the pairing code out of the config file in plain text', () => {
  const store = fresh()
  store.writeConfig({ server: 'https://aspenne.tech', token: 'pasen_secret', pairedAs: null, openAtLogin: false })

  assert.equal(fs.readFileSync(store.configPath, 'utf8').includes('pasen_secret'), false)
  assert.equal(store.readConfig().token, 'pasen_secret')
})

test('starts on the real site with no pairing when there is no config yet', () => {
  assert.deepEqual(fresh().readConfig(), {
    server: 'https://aspenne.tech',
    token: null,
    pairedAs: null,
    openAtLogin: false,
  })
})

test('writes every capture to disk before anything is sent, under the agent file name', () => {
  const store = fresh()
  const entry = store.saveCapture({ gameData: { gameMode: 'CLASSIC' } }, { gameMode: 'CLASSIC' })

  assert.match(entry.fileName, /^custom-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/)
  assert.deepEqual(store.readCapture(entry.fileName), { gameData: { gameMode: 'CLASSIC' } })
  assert.equal(store.listCaptures()[0].sentUrl, null)
})

test('remembers what was sent, and lets an ignored game leave the list', () => {
  const store = fresh()
  const entry = store.saveCapture({}, {})

  store.markSent(entry.fileName, '/arigafion/customs/9', 'Finale')
  assert.equal(store.listCaptures()[0].sentUrl, '/arigafion/customs/9')
  assert.equal(store.listCaptures()[0].label, 'Finale')

  store.dismiss(entry.fileName)
  assert.equal(store.listCaptures().length, 0)
})
