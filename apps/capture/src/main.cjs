'use strict'

const path = require('node:path')
const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Notification,
  nativeImage,
  safeStorage,
  shell,
  Tray,
} = require('electron')

const { Watcher } = require('./watcher.cjs')
const { Store } = require('./store.cjs')
const pasen = require('./pasen.cjs')

/**
 * Pasen Capture: sits in the tray, catches every game the League client
 * shows it, and lets the player send the customs to the site with one click.
 *
 * It never sends anything on its own. The Live Client API serves ranked games
 * exactly as it serves customs, and from inside a game there is no telling
 * them apart - so the person who just played decides.
 */

// One copy only: a second launch brings the first one forward instead.
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

let window = null
let tray = null
let store = null
let watcher = null
let live = { state: 'waiting' }
let quitting = false

const asset = (name) => path.join(__dirname, '..', 'assets', name)

function createWindow() {
  window = new BrowserWindow({
    width: 460,
    height: 680,
    minWidth: 380,
    minHeight: 480,
    title: 'Pasen Capture',
    backgroundColor: '#070c17',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  window.once('ready-to-show', () => {
    // Started with the computer: stay in the tray rather than popping up.
    if (!process.argv.includes('--hidden')) window.show()
  })

  // Closing the window keeps the app watching from the tray; Quit is in its menu.
  window.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    window.hide()
  })

  // Links from the page open in the real browser, never inside the app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

function showWindow() {
  if (!window) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

function createTray() {
  const icon = nativeImage.createFromPath(asset('tray.png'))
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('Pasen Capture')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Pasen Capture', click: showWindow },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          quitting = true
          app.quit()
        },
      },
    ])
  )
  tray.on('click', showWindow)
}

function send(channel, payload) {
  if (window && !window.isDestroyed()) window.webContents.send(channel, payload)
}

function publicState() {
  const config = store.readConfig()
  return {
    // The pairing code never crosses into the page.
    paired: Boolean(config.token),
    pairedAs: config.pairedAs,
    server: config.server,
    openAtLogin: config.openAtLogin,
    live,
    captures: store.listCaptures().slice(0, 30),
  }
}

function startWatching() {
  watcher = new Watcher()

  watcher.on('status', (status) => {
    live = status
    send('live', status)
    tray?.setToolTip(status.state === 'playing' ? 'Pasen Capture · game in progress' : 'Pasen Capture')
  })

  watcher.on('ended', ({ snapshot, summary }) => {
    if (!summary.players) return
    store.saveCapture(snapshot, summary)
    send('captures', store.listCaptures().slice(0, 30))

    if (Notification.isSupported()) {
      const me = summary.me
      const notice = new Notification({
        title: 'Game captured',
        body: me
          ? `${me.champion} ${me.kills}/${me.deaths}/${me.assists}. A custom? Send it to Pasen.`
          : 'Open Pasen Capture to send it if it was a custom.',
        silent: true,
      })
      notice.on('click', showWindow)
      notice.show()
    }
  })

  watcher.start()
}

/* ---------- what the page can ask for ---------- */

ipcMain.handle('state', () => publicState())

ipcMain.handle('pair', async (_event, { code, server }) => {
  const token = String(code ?? '').trim()
  const base = String(server ?? '').trim() || 'https://aspenne.tech'
  if (!token) return { ok: false, message: 'Paste the code from the admin first.' }

  const answer = await pasen.whoami(base, token)
  if (!answer.ok) {
    return {
      ok: false,
      message: answer.status === 401 ? 'That code was not accepted. Pair the PC again in the admin.' : answer.message,
    }
  }

  const config = store.readConfig()
  store.writeConfig({ ...config, server: base, token, pairedAs: answer.body })
  return { ok: true, state: publicState() }
})

ipcMain.handle('unpair', () => {
  store.writeConfig({ ...store.readConfig(), token: null, pairedAs: null })
  return publicState()
})

ipcMain.handle('send', async (_event, { fileName, label }) => {
  const config = store.readConfig()
  if (!config.token) return { ok: false, message: 'Pair this PC first.' }

  const entry = store.listCaptures().find((item) => item.fileName === fileName)
  if (!entry) return { ok: false, message: 'That capture is no longer here.' }

  const answer = await pasen.upload(config.server, config.token, {
    capture: store.readCapture(fileName),
    fileName,
    capturedAt: entry.capturedAt,
    label,
  })
  if (!answer.ok) return answer

  store.markSent(fileName, answer.body.url, label)
  return { ok: true, url: answer.body.url, duplicate: answer.body.duplicate, state: publicState() }
})

ipcMain.handle('dismiss', (_event, { fileName }) => {
  store.dismiss(fileName)
  return publicState()
})

ipcMain.handle('open', (_event, { pathname }) => {
  // Only paths on the paired site: the page cannot make the app open anything else.
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) return
  shell.openExternal(new URL(pathname, store.readConfig().server).toString())
})

ipcMain.handle('open-at-login', (_event, { enabled }) => {
  app.setLoginItemSettings({ openAtLogin: Boolean(enabled), args: ['--hidden'] })
  store.writeConfig({ ...store.readConfig(), openAtLogin: Boolean(enabled) })
  return publicState()
})

/* ---------- lifecycle ---------- */

app.on('second-instance', showWindow)

app.whenReady().then(() => {
  store = new Store(app.getPath('userData'), safeStorage)
  createWindow()
  createTray()
  startWatching()

  // macOS: clicking the dock icon brings the window back.
  app.on('activate', showWindow)
})

app.on('before-quit', () => {
  quitting = true
  watcher?.stop()
})

// The app lives in the tray; closing every window does not end it.
app.on('window-all-closed', () => {})
