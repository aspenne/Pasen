'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')

const pasen = require('../src/pasen.cjs')

/** A stand-in for the site that records what it was sent. */
function fakeSite(handler) {
  return new Promise((resolve) => {
    const seen = []
    const server = http.createServer((request, response) => {
      let body = ''
      request.on('data', (chunk) => (body += chunk))
      request.on('end', () => {
        seen.push({ method: request.method, url: request.url, auth: request.headers.authorization, body: body ? JSON.parse(body) : null })
        const [status, payload] = handler(request)
        response.writeHead(status, { 'content-type': 'application/json' })
        response.end(JSON.stringify(payload))
      })
    })
    server.listen(0, '127.0.0.1', () => resolve({ server, seen, base: `http://127.0.0.1:${server.address().port}` }))
  })
}

test('checks a pairing with the code as a bearer token', async () => {
  const site = await fakeSite(() => [200, { device: { name: 'PC salon' }, group: { slug: 'arigafion', name: 'ARIGAFION' } }])
  const answer = await pasen.whoami(site.base, 'pasen_abc')
  site.server.close()

  assert.equal(answer.ok, true)
  assert.equal(answer.body.group.name, 'ARIGAFION')
  assert.equal(site.seen[0].url, '/api/capture/whoami')
  assert.equal(site.seen[0].auth, 'Bearer pasen_abc')
})

test('sends the capture with its file name, so the site can date it', async () => {
  const site = await fakeSite(() => [201, { id: 9, duplicate: false, url: '/arigafion/customs/9' }])
  const answer = await pasen.upload(site.base, 'pasen_abc', {
    capture: { gameData: { gameMode: 'CLASSIC' } },
    fileName: 'custom-2026-10-09T21-00-00-000Z.json',
    capturedAt: '2026-10-09T21:00:00.000Z',
    label: 'Finale',
  })
  site.server.close()

  assert.equal(answer.ok, true)
  assert.equal(answer.body.url, '/arigafion/customs/9')
  assert.equal(site.seen[0].method, 'POST')
  assert.equal(site.seen[0].body.fileName, 'custom-2026-10-09T21-00-00-000Z.json')
  assert.equal(site.seen[0].body.label, 'Finale')
})

test("passes the site's own explanation through when it refuses", async () => {
  const site = await fakeSite(() => [401, { message: 'This PC is not linked, or its link was revoked.' }])
  const answer = await pasen.upload(site.base, 'pasen_old', { capture: {}, fileName: 'x.json' })
  site.server.close()

  assert.equal(answer.ok, false)
  assert.equal(answer.status, 401)
  assert.match(answer.message, /not linked/)
})

test('says plainly when the site cannot be reached', async () => {
  const answer = await pasen.whoami('http://127.0.0.1:9', 'pasen_abc')

  assert.equal(answer.ok, false)
  assert.match(answer.message, /Could not reach 127\.0\.0\.1/)
})

test('reads the fearless night with the pairing code', async () => {
  const site = await fakeSite(() => [200, { night: { label: 'Vendredi', active: true }, burned: [{}, {}] }])
  let answer
  try {
    answer = await pasen.fearless(site.base, 'pasen_abc')
  } finally {
    // Closed even when the call throws, or node --test waits on the open server.
    site.server.close()
  }

  assert.equal(answer.ok, true)
  assert.equal(site.seen[0].url, '/api/capture/fearless')
  assert.equal(site.seen[0].auth, 'Bearer pasen_abc')
})

test('sums a running night up for the window', () => {
  const summary = pasen.fearlessSummary(
    { ok: true, body: { night: { label: 'Vendredi', active: true }, burned: [{}, {}, {}] } },
    'arigafion'
  )
  assert.deepEqual(summary, { label: 'Vendredi', burned: 3, pathname: '/arigafion/fearless' })
})

test('shows nothing without a running night or without the site', () => {
  assert.equal(pasen.fearlessSummary({ ok: true, body: {} }, 'arigafion'), null)
  assert.equal(
    pasen.fearlessSummary({ ok: true, body: { night: { active: false }, burned: [] } }, 'arigafion'),
    null
  )
  assert.equal(pasen.fearlessSummary({ ok: false, message: 'offline' }, 'arigafion'), null)
})
