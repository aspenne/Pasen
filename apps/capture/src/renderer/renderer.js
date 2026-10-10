'use strict'

/*
 * The window. Everything shown here is built with textContent: player names
 * come straight out of a game, and none of them should ever be read as HTML.
 */

const $ = (id) => document.getElementById(id)

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function clock(seconds) {
  const s = Math.max(0, Math.round(seconds || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

let state = null

function render() {
  if (!state) return

  // ---- pairing ----
  $('pair').hidden = state.paired
  $('unpair').hidden = !state.paired
  $('link-state').textContent = state.paired && state.pairedAs
    ? `${state.pairedAs.device.name} · ${state.pairedAs.group.name}`
    : 'Not linked'
  $('pair-server').value = state.server
  $('open-at-login').checked = state.openAtLogin

  renderLive(state.live)
  renderFearless(state.fearless)
  renderUpdate(state.update)
  renderCaptures(state.captures)
}

function renderLive(live) {
  const playing = live?.state === 'playing'
  $('live-dot').className = playing ? 'dot playing' : 'dot'
  if (!playing) {
    $('live-title').textContent = 'Waiting for a game'
    $('live-detail').textContent = 'Leave this open; it watches by itself.'
    return
  }
  const summary = live.summary
  $('live-title').textContent = `In game · ${clock(summary.gameTime)}`
  $('live-detail').textContent = summary.me
    ? `${summary.me.champion} ${summary.me.kills}/${summary.me.deaths}/${summary.me.assists} · ${summary.players} players`
    : `${summary.gameMode} · ${summary.players} players`
}

function renderUpdate(update) {
  $('update').hidden = !update
  if (update) $('update-title').textContent = `Version ${update.version} is available`
}

function renderFearless(summary) {
  $('fearless').hidden = !summary
  if (!summary) return
  $('fearless-title').textContent = `${summary.label ?? 'Fearless night'} in progress`
  $('fearless-detail').textContent = `${summary.burned} champion${summary.burned === 1 ? '' : 's'} burned so far`
}

function renderCaptures(captures) {
  const list = $('captures')
  list.replaceChildren()
  $('captures-empty').hidden = captures.length > 0

  for (const capture of captures) {
    const summary = capture.summary || {}
    const result = summary.result === 'Win' ? 'win' : summary.result === 'Lose' ? 'loss' : 'unknown'
    const item = el('li', `capture ${result === 'unknown' ? '' : result}`)

    const head = el('div', 'capture-head')
    const title = el('div')
    const name = el(
      'span',
      'capture-title',
      summary.me ? `${summary.me.champion} ${summary.me.kills}/${summary.me.deaths}/${summary.me.assists}` : summary.gameMode || 'Game'
    )
    title.append(name)
    // One human and the rest bots: practice, which the site leaves out of its stats.
    if (summary.players && summary.humans <= 1) title.append(el('span', 'tag', 'vs bots'))
    head.append(
      title,
      el('span', `result ${result}`, result === 'win' ? 'Victory' : result === 'loss' ? 'Defeat' : 'No result')
    )

    const when = new Date(capture.capturedAt)
    const meta = el(
      'div',
      'capture-meta',
      `${when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} · ${clock(summary.gameTime)} · ${summary.players || '?'} players`
    )

    const actions = el('div', 'actions')
    if (capture.sentUrl) {
      actions.append(el('span', 'sent', `Sent${capture.label ? ` as “${capture.label}”` : ''}`))
      const open = el('button', 'link', 'Open on Pasen')
      open.addEventListener('click', () => window.capture.open(capture.sentUrl))
      actions.append(open)
    } else {
      const label = el('input')
      label.type = 'text'
      label.placeholder = 'Name it (optional)'
      label.maxLength = 80

      const sendButton = el('button', 'primary', 'Send to Pasen')
      sendButton.disabled = !state.paired
      if (!state.paired) sendButton.title = 'Link this PC first'

      const ignore = el('button', 'secondary', 'Ignore')
      const error = el('p', 'error')
      error.setAttribute('role', 'alert')

      // During a fearless night the list only knows a game once it is sent.
      const reminder = state.fearless
        ? el('p', 'muted small', 'Send it so the fearless list knows these champions are gone.')
        : null

      sendButton.addEventListener('click', async () => {
        sendButton.disabled = true
        sendButton.textContent = 'Sending…'
        error.textContent = ''
        const answer = await window.capture.send(capture.fileName, label.value.trim())
        if (answer.ok) {
          state = answer.state
          render()
        } else {
          // The capture stays on disk; trying again is always possible.
          error.textContent = `${answer.message} Nothing is lost, try again.`
          sendButton.disabled = false
          sendButton.textContent = 'Try again'
        }
      })

      ignore.addEventListener('click', async () => {
        state = await window.capture.dismiss(capture.fileName)
        render()
      })

      actions.append(label, sendButton, ignore)
      item.append(head, meta, ...(reminder ? [reminder] : []), actions, error)
      list.append(item)
      continue
    }

    item.append(head, meta, actions)
    list.append(item)
  }
}

// ---- events ----

$('pair-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  $('pair-error').textContent = ''
  const answer = await window.capture.pair($('pair-code').value, $('pair-server').value)
  if (answer.ok) {
    $('pair-code').value = ''
    state = answer.state
    render()
  } else {
    $('pair-error').textContent = answer.message
  }
})

$('unpair').addEventListener('click', async () => {
  state = await window.capture.unpair()
  render()
})

$('open-at-login').addEventListener('change', async (event) => {
  state = await window.capture.openAtLogin(event.target.checked)
  render()
})

window.capture.onLive((live) => {
  if (!state) return
  state.live = live
  renderLive(live)
})

$('update-open').addEventListener('click', () => window.capture.openUpdate())

window.capture.onUpdate((update) => {
  if (!state) return
  state.update = update
  renderUpdate(update)
})

$('fearless-open').addEventListener('click', () => {
  if (state?.fearless) window.capture.open(state.fearless.pathname)
})

window.capture.onFearless((summary) => {
  if (!state) return
  const reminderChanged = Boolean(state.fearless) !== Boolean(summary)
  state.fearless = summary
  renderFearless(summary)
  /*
   * Redrawing the list wipes a half-typed name and resets a send in flight, so
   * only when the reminder under each capture appears or goes away.
   */
  if (reminderChanged) renderCaptures(state.captures)
})

window.capture.onCaptures((captures) => {
  if (!state) return
  state.captures = captures
  renderCaptures(captures)
})

window.capture.state().then((initial) => {
  state = initial
  render()
})
