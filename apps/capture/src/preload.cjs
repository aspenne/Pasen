'use strict'

const { contextBridge, ipcRenderer } = require('electron')

/**
 * The only door between the page and the app. Each method is one named
 * request; the page cannot read the pairing code, touch the disk, or open a
 * URL that is not on the paired site.
 */
contextBridge.exposeInMainWorld('capture', {
  state: () => ipcRenderer.invoke('state'),
  pair: (code, server) => ipcRenderer.invoke('pair', { code, server }),
  unpair: () => ipcRenderer.invoke('unpair'),
  send: (fileName, label) => ipcRenderer.invoke('send', { fileName, label }),
  dismiss: (fileName) => ipcRenderer.invoke('dismiss', { fileName }),
  open: (pathname) => ipcRenderer.invoke('open', { pathname }),
  openAtLogin: (enabled) => ipcRenderer.invoke('open-at-login', { enabled }),
  onLive: (listener) => ipcRenderer.on('live', (_event, status) => listener(status)),
  openUpdate: () => ipcRenderer.invoke('open-update'),
  onUpdate: (listener) => ipcRenderer.on('update', (_event, update) => listener(update)),
  onFearless: (listener) => ipcRenderer.on('fearless', (_event, summary) => listener(summary)),
  onCaptures: (listener) => ipcRenderer.on('captures', (_event, captures) => listener(captures)),
})
