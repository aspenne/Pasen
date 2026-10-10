'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')

const updates = require('../src/updates.cjs')

test('finds a newer release from its tag', () => {
  assert.equal(updates.newerVersion('0.2.0', 'capture-v0.3.0'), '0.3.0')
  assert.equal(updates.newerVersion('0.2.0', 'capture-v0.10.0'), '0.10.0')
  assert.equal(updates.newerVersion('0.2.0', 'capture-v1.0.0'), '1.0.0')
})

test('stays quiet for the same, an older, or an unrelated release', () => {
  assert.equal(updates.newerVersion('0.2.0', 'capture-v0.2.0'), null)
  assert.equal(updates.newerVersion('0.2.0', 'capture-v0.1.9'), null)
  assert.equal(updates.newerVersion('0.2.0', 'v9.0.0'), null)
  assert.equal(updates.newerVersion('0.2.0', undefined), null)
})

function fakeGitHub(status, body) {
  return new Promise((resolve) => {
    const server = http.createServer((_request, response) => {
      response.writeHead(status, { 'content-type': 'application/json' })
      response.end(JSON.stringify(body))
    })
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/latest` }))
  })
}

test('reads the latest release, with the page to download it from', async () => {
  const site = await fakeGitHub(200, {
    tag_name: 'capture-v0.3.0',
    html_url: 'https://github.com/aspenne/Pasen/releases/tag/capture-v0.3.0',
  })
  let update
  try {
    update = await updates.checkForUpdate('0.2.0', site.url)
  } finally {
    site.server.close()
  }
  assert.deepEqual(update, {
    version: '0.3.0',
    url: 'https://github.com/aspenne/Pasen/releases/tag/capture-v0.3.0',
  })
})

test('says nothing when GitHub cannot be reached or refuses', async () => {
  const site = await fakeGitHub(403, { message: 'rate limited' })
  let refused
  try {
    refused = await updates.checkForUpdate('0.2.0', site.url)
  } finally {
    site.server.close()
  }
  assert.equal(refused, null)
  assert.equal(await updates.checkForUpdate('0.2.0', 'http://127.0.0.1:1/latest'), null)
})

test('only ever points at this project’s releases', async () => {
  const site = await fakeGitHub(200, { tag_name: 'capture-v0.3.0', html_url: 'https://evil.example/download' })
  let update
  try {
    update = await updates.checkForUpdate('0.2.0', site.url)
  } finally {
    site.server.close()
  }
  assert.equal(update.url, 'https://github.com/aspenne/Pasen/releases/latest')
})
