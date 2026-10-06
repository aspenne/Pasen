import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'

import { viewCustomGame, type ViewLookups } from '#customs/custom_game_view'

/**
 * A real capture: a custom against nine bots on 6 October, uploaded through
 * the admin. Trimmed of tooltip text, otherwise as the agent wrote it.
 */
async function realCapture() {
  const raw = JSON.parse(
    await readFile(new URL('../../fixtures/customs/vs_bots.json', import.meta.url), 'utf8')
  )
  return {
    id: 1,
    label: 'Test custom solo',
    playedAt: '2026-10-06T19:17:54.000Z',
    duration: 1198,
    gameMode: 'CLASSIC',
    mapName: 'Map11',
    raw,
  }
}

const lookups: ViewLookups = {
  championIdBySlug: new Map([
    ['Camille', 164],
    ['Ahri', 103],
    ['Lux', 99],
    ['Darius', 122],
    ['Teemo', 17],
    ['Galio', 3],
    ['Cassiopeia', 69],
    ['Anivia', 34],
    ['MasterYi', 11],
  ]),
  spellIdBySlug: new Map([
    ['SummonerFlash', 4],
    ['SummonerHaste', 6],
    ['SummonerDot', 14],
  ]),
  memberByRiotId: new Map([['3c patate chaude#ccc', { slug: '3c-patate-chaude', displayName: '3C Patate Chaude' }]]),
}

test.group('viewCustomGame', () => {
  /*
   * The capture never names a winner. "Win" in GameEnd is from the point of
   * view of whoever ran the agent - here 3C Patate Chaude, on ORDER.
   */
  test("reads the winner from the capturer's own GameEnd", async ({ assert }) => {
    const view = viewCustomGame(await realCapture(), lookups)

    assert.isTrue(view.resultKnown)
    assert.equal(view.capturedBy, '3C Patate Chaude#CCC')
    assert.isTrue(view.teams.find((team) => team.side === 'ORDER')!.won)
    assert.isFalse(view.teams.find((team) => team.side === 'CHAOS')!.won)
  })

  test('says it does not know rather than guessing when GameEnd is missing', async ({ assert }) => {
    const game = await realCapture()
    game.raw.events.Events = game.raw.events.Events.filter(
      (event: { EventName: string }) => event.EventName !== 'GameEnd'
    )

    const view = viewCustomGame(game, lookups)

    assert.isFalse(view.resultKnown)
    assert.isTrue(view.teams.every((team) => team.won === null))
  })

  test('links the human to their member page and leaves bots unlinked', async ({ assert }) => {
    const view = viewCustomGame(await realCapture(), lookups)
    const players = view.teams.flatMap((team) => team.players)

    const human = players.find((player) => !player.isBot)!
    assert.equal(human.memberSlug, '3c-patate-chaude')
    assert.equal(human.name, '3C Patate Chaude')

    const bots = players.filter((player) => player.isBot)
    assert.lengthOf(bots, 9)
    assert.isTrue(bots.every((bot) => bot.memberSlug === null))
    assert.include(bots.map((bot) => bot.name), 'Master Yi (bot)')
  })

  test('recognises practice against bots', async ({ assert }) => {
    const view = viewCustomGame(await realCapture(), lookups)

    assert.isTrue(view.againstBots)
    assert.equal(view.mapName, "Summoner's Rift")
  })

  /* No champion id in the capture: it comes from the tail of the raw name. */
  test('recovers every champion id from the raw display name', async ({ assert }) => {
    const view = viewCustomGame(await realCapture(), lookups)
    const players = view.teams.flatMap((team) => team.players)

    assert.isTrue(players.every((player) => player.championId > 0))
    assert.equal(players.find((p) => p.championName === 'Master Yi')!.championId, 11)
  })

  test('keeps items in their slots and shapes runes for the rune component', async ({ assert }) => {
    const view = viewCustomGame(await realCapture(), lookups)
    const camille = view.teams[0].players.find((player) => player.championName === 'Camille')!

    assert.deepEqual(camille.items, [1055, 3074, 3009, 3078, 3161, 2055, 3340])
    assert.equal(camille.perks.styles[0].selections![0].perk, 8437)
    assert.equal(camille.perks.styles[1].style, 8300)
    assert.deepEqual(camille.summonerSpells, [4, 6])
  })

  test('adds the score up and credits structures by what fell', async ({ assert }) => {
    const view = viewCustomGame(await realCapture(), lookups)
    const order = view.teams.find((team) => team.side === 'ORDER')!
    const chaos = view.teams.find((team) => team.side === 'CHAOS')!

    assert.equal(order.kills, 36 + 4 + 5 + 2 + 6)
    assert.equal(order.kills + chaos.kills, 65)
    assert.equal(order.objectives.turrets + chaos.objectives.turrets, 9)
    assert.isAtLeast(order.objectives.inhibitors, 1)
  })

  test('finds the first blood and the best multikill', async ({ assert }) => {
    const view = viewCustomGame(await realCapture(), lookups)
    const camille = view.teams[0].players.find((player) => player.championName === 'Camille')!

    assert.equal(view.firstBlood, '3C Patate Chaude')
    assert.isAtLeast(camille.bestMultikill, 3)
  })
})
