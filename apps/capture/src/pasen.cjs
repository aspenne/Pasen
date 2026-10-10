'use strict'

/**
 * The calls the app makes to the site, with the pairing code as a bearer
 * token. All answer the same shape so the window can show one kind of error.
 */
async function call(server, token, pathname, init = {}) {
  let response
  try {
    response = await fetch(new URL(pathname, server), {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    })
  } catch {
    return { ok: false, message: `Could not reach ${new URL(server).host}. Check the connection and try again.` }
  }

  const body = await response.json().catch(() => ({}))
  if (response.ok) return { ok: true, body }
  return {
    ok: false,
    status: response.status,
    message: body.message ?? `The site answered ${response.status}.`,
  }
}

/** Checks a pairing code and says which group and PC it belongs to. */
function whoami(server, token) {
  return call(server, token, '/api/capture/whoami')
}

/** Sends one capture. A game sent twice is stored once; the answer says so. */
function upload(server, token, { capture, fileName, capturedAt, label }) {
  return call(server, token, '/api/capture/customs', {
    method: 'POST',
    body: JSON.stringify({ capture, fileName, capturedAt, label: label || undefined }),
  })
}

/** The group's fearless night; a 204 (no night yet) comes back as an empty body. */
function fearless(server, token) {
  return call(server, token, '/api/capture/fearless')
}

/**
 * What the window shows of a fearless night: nothing unless one is running.
 * A failed call is "nothing" too - the banner is a reminder, not something to
 * raise an error about.
 */
function fearlessSummary(answer, groupSlug) {
  const night = answer?.ok ? answer.body?.night : null
  if (!night?.active || !groupSlug) return null
  return {
    label: night.label ?? null,
    burned: Array.isArray(answer.body.burned) ? answer.body.burned.length : 0,
    pathname: `/${groupSlug}/fearless`,
  }
}

/** Whether a poll changed anything the window shows; an unchanged one is not pushed. */
function sameFearless(a, b) {
  if (!a || !b) return a === b
  return a.label === b.label && a.burned === b.burned && a.pathname === b.pathname
}

module.exports = { whoami, upload, fearless, fearlessSummary, sameFearless }
