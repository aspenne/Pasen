'use strict'

/**
 * The two calls the app makes to the site, with the pairing code as a bearer
 * token. Both answer the same shape so the window can show one kind of error.
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

module.exports = { whoami, upload }
