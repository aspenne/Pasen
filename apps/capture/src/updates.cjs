'use strict'

/**
 * Tells the player a newer Pasen Capture is out.
 *
 * Not an automatic update: the app is unsigned, and macOS refuses to let an
 * unsigned app replace itself. So it only checks GitHub's latest release and
 * offers the download page; installing stays a click away.
 */
const LATEST = 'https://api.github.com/repos/aspenne/Pasen/releases/latest'
const RELEASES = 'https://github.com/aspenne/Pasen/releases/'
const TAG = /^capture-v(\d+)\.(\d+)\.(\d+)$/

/** The release's version when it is newer than `current`, otherwise null. */
function newerVersion(current, tag) {
  const match = TAG.exec(tag ?? '')
  if (!match) return null
  const next = match.slice(1).map(Number)
  const now = String(current).split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (next[i] !== (now[i] ?? 0)) return next[i] > (now[i] ?? 0) ? next.join('.') : null
  }
  return null
}

/**
 * `{ version, url }` when a newer release exists; null otherwise, including
 * when GitHub cannot be reached - a missed check just waits for the next one.
 */
async function checkForUpdate(current, endpoint = LATEST) {
  try {
    const response = await fetch(endpoint, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'pasen-capture' },
    })
    if (!response.ok) return null
    const release = await response.json()
    const version = newerVersion(current, release.tag_name)
    if (!version) return null
    // The page the app opens is ours, whatever the answer says.
    const url =
      typeof release.html_url === 'string' && release.html_url.startsWith(RELEASES)
        ? release.html_url
        : `${RELEASES}latest`
    return { version, url }
  } catch {
    return null
  }
}

module.exports = { newerVersion, checkForUpdate, RELEASES }
