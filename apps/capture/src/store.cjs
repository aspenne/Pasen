'use strict'

const fs = require('node:fs')
const path = require('node:path')

/**
 * Everything the app keeps on disk, in the folder the OS gives it.
 *
 * The pairing code is encrypted with the OS keychain when one is available
 * (Electron's safeStorage): it can send games to the group, so it is not left
 * readable in a JSON file. Every capture is also written to disk before any
 * upload is attempted, so a failed send - no network, a server restart - never
 * costs a game; it waits in the list with a button to try again.
 */
class Store {
  constructor(directory, crypto) {
    this.directory = directory
    this.crypto = crypto
    this.capturesDir = path.join(directory, 'captures')
    this.configPath = path.join(directory, 'config.json')
    fs.mkdirSync(this.capturesDir, { recursive: true })
  }

  readConfig() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.configPath, 'utf8'))
      return {
        server: raw.server || 'https://aspenne.tech',
        token: raw.token ? this.#decrypt(raw.token) : null,
        pairedAs: raw.pairedAs ?? null,
        openAtLogin: Boolean(raw.openAtLogin),
      }
    } catch {
      return { server: 'https://aspenne.tech', token: null, pairedAs: null, openAtLogin: false }
    }
  }

  writeConfig(config) {
    const stored = { ...config, token: config.token ? this.#encrypt(config.token) : null }
    fs.writeFileSync(this.configPath, JSON.stringify(stored, null, 2))
  }

  /** Writes a capture under the agent's own file name, so the site can read the time back out. */
  saveCapture(snapshot, summary) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `custom-${stamp}.json`
    fs.writeFileSync(path.join(this.capturesDir, fileName), JSON.stringify(snapshot))
    const entry = { fileName, capturedAt: new Date().toISOString(), summary, sentUrl: null, label: null }
    this.#writeEntry(entry)
    return entry
  }

  listCaptures() {
    return fs
      .readdirSync(this.capturesDir)
      .filter((name) => name.endsWith('.meta.json'))
      .map((name) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(this.capturesDir, name), 'utf8'))
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1))
  }

  readCapture(fileName) {
    return JSON.parse(fs.readFileSync(path.join(this.capturesDir, path.basename(fileName)), 'utf8'))
  }

  markSent(fileName, url, label) {
    const entry = this.listCaptures().find((item) => item.fileName === fileName)
    if (entry) this.#writeEntry({ ...entry, sentUrl: url, label: label ?? entry.label })
  }

  /** Ignoring a game removes it from the list; the capture file itself stays, just in case. */
  dismiss(fileName) {
    const meta = path.join(this.capturesDir, `${path.basename(fileName)}.meta.json`)
    if (fs.existsSync(meta)) fs.rmSync(meta)
  }

  #writeEntry(entry) {
    fs.writeFileSync(path.join(this.capturesDir, `${entry.fileName}.meta.json`), JSON.stringify(entry, null, 2))
  }

  #encrypt(value) {
    if (this.crypto?.isEncryptionAvailable()) {
      return { encrypted: this.crypto.encryptString(value).toString('base64') }
    }
    return { plain: value }
  }

  #decrypt(stored) {
    if (typeof stored === 'string') return stored
    if (stored.encrypted && this.crypto?.isEncryptionAvailable()) {
      return this.crypto.decryptString(Buffer.from(stored.encrypted, 'base64'))
    }
    return stored.plain ?? null
  }
}

module.exports = { Store }
