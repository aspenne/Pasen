'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')

const { Watcher } = require('../src/watcher.cjs')

/** A game at a given clock, ended or not, as the Live Client would serve it. */
function snapshot({ time, ended = false, champions = ['Camille', 'Ahri'] }) {
  return {
    activePlayer: { riotId: 'Patate#CCC' },
    allPlayers: champions.map((championName, index) => ({
      riotId: index === 0 ? 'Patate#CCC' : `Bot${index}#BOT`,
      championName,
      team: index % 2 ? 'CHAOS' : 'ORDER',
      isBot: index !== 0,
      scores: { kills: 3, deaths: 1, assists: 2 },
    })),
    gameData: { gameMode: 'CLASSIC', gameTime: time },
    events: {
      Events: [
        { EventName: 'GameStart', EventTime: 0.03 },
        ...(ended ? [{ EventName: 'GameEnd', EventTime: time, Result: 'Win' }] : []),
      ],
    },
  }
}

/** Plays a script of responses - a snapshot, or null for "no game window". */
function run(script) {
  return new Promise((resolve) => {
    let step = 0
    const ended = []
    const watcher = new Watcher({
      pollMs: 0,
      fetch: async () => {
        const next = script[step++]
        if (step > script.length) {
          watcher.stop()
          resolve(ended)
          throw new Error('done')
        }
        if (next === null) throw new Error('no game')
        return next
      },
    })
    watcher.on('ended', (event) => ended.push(event))
    watcher.start()
  })
}

test('hands a game over once at GameEnd, however long its window lingers', async () => {
  const ended = await run([
    null,
    snapshot({ time: 600 }),
    snapshot({ time: 1200, ended: true }),
    snapshot({ time: 1200, ended: true }),
    snapshot({ time: 1200, ended: true }),
    null,
  ])

  assert.equal(ended.length, 1)
  assert.equal(ended[0].reason, 'GameEnd')
  assert.equal(ended[0].summary.result, 'Win')
  assert.equal(ended[0].summary.me.champion, 'Camille')
})

test('still hands a game over when the window closes before GameEnd', async () => {
  const ended = await run([snapshot({ time: 300 }), snapshot({ time: 900 }), null, null])

  assert.equal(ended.length, 1)
  assert.equal(ended[0].reason, 'the game window closed')
  assert.equal(ended[0].summary.gameTime, 900)
  assert.equal(ended[0].summary.result, null)
})

test('keeps watching after a game, and catches the next one', async () => {
  const ended = await run([
    snapshot({ time: 1500, ended: true }),
    null,
    snapshot({ time: 200 }),
    snapshot({ time: 1700, ended: true }),
    null,
  ])

  assert.equal(ended.length, 2)
})

/* A rematch with the same picks is a new game, not the old one lingering. */
test('tells two games with the same picks apart', async () => {
  const ended = await run([
    snapshot({ time: 1500, ended: true }),
    null,
    snapshot({ time: 1600, ended: true }),
    null,
  ])

  assert.equal(ended.length, 2)
})

test('counts the humans, so the window can say a game was against bots', async () => {
  const ended = await run([snapshot({ time: 1200, ended: true, champions: ['Camille', 'Ahri', 'Lux'] }), null])

  assert.equal(ended[0].summary.players, 3)
  assert.equal(ended[0].summary.humans, 1)
})
