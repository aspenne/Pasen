import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'

import { viewCustomGame, type ViewLookups } from '#customs/custom_game_view'
import {
  customGameIdOf,
  customMatchId,
  customMatchRows,
  mirrorable,
} from '#customs/custom_match_rows'

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
  spellIdBySlug: new Map([['SummonerFlash', 4]]),
  memberByRiotId: new Map([['3c patate chaude#ccc', { slug: '3c-patate-chaude', displayName: '3C Patate Chaude' }]]),
}

/** The real capture, with two bots turned into friends so it is an inhouse. */
async function inhouse() {
  const raw = JSON.parse(
    await readFile(new URL('../../fixtures/customs/vs_bots.json', import.meta.url), 'utf8')
  )
  for (const [index, name] of [[1, 'Bea'], [5, 'Cyd']] as const) {
    Object.assign(raw.allPlayers[index], {
      isBot: false,
      riotId: `${name}#EUW`,
      riotIdGameName: name,
      summonerName: name,
    })
  }
  return viewCustomGame(
    { id: 7, label: null, playedAt: '2026-10-06T19:17:54.000Z', duration: 1198, gameMode: 'CLASSIC', mapName: 'Map11', raw },
    lookups
  )
}

const puuids = new Map([['3c patate chaude#ccc', 'real-puuid-of-patate']])

test.group('customMatchRows', () => {
  test('writes the game under the custom queue group, eligible for stats', async ({ assert }) => {
    const { match } = customMatchRows(await inhouse(), puuids, 'euw1', new Date())

    assert.equal(match.match_id, 'CUSTOM_7')
    assert.equal(match.queue_group, 'custom')
    assert.isTrue(match.stats_eligible)
    assert.equal(match.participant_count, 10)
    assert.equal((match.game_ended_at as Date).toISOString(), '2026-10-06T19:37:52.000Z')
  })

  /* The puuid is the join to a member's pages - it has to be the real one. */
  test("gives a member their real puuid, and everyone else a stand-in", async ({ assert }) => {
    const { participants } = customMatchRows(await inhouse(), puuids, 'euw1', new Date())

    const patate = participants.find((row) => row.riot_id_game_name === '3C Patate Chaude')!
    const bea = participants.find((row) => row.riot_id_game_name === 'Bea')!
    assert.equal(patate.puuid, 'real-puuid-of-patate')
    assert.equal(bea.puuid, 'custom:bea#euw')
  })

  test('keeps two bots on the same champion apart', async ({ assert }) => {
    const { participants } = customMatchRows(await inhouse(), puuids, 'euw1', new Date())

    const keys = participants.map((row) => row.puuid)
    assert.equal(new Set(keys).size, keys.length)
  })

  test('writes the result, the multikills and first blood', async ({ assert }) => {
    const { participants } = customMatchRows(await inhouse(), puuids, 'euw1', new Date())
    const patate = participants.find((row) => row.riot_id_game_name === '3C Patate Chaude')!

    assert.isTrue(patate.win)
    assert.equal(patate.team_id, 100)
    assert.equal(patate.penta_kills, 1)
    assert.equal(patate.quadra_kills, 1)
    assert.isTrue(patate.first_blood_kill)
    // No gold or damage in a Live Client capture: zero, not invented.
    assert.equal(patate.gold_earned, 0)
    assert.equal(patate.damage_dealt, 0)
  })
})

test.group('mirrorable', () => {
  test('takes an inhouse with a result', async ({ assert }) => {
    assert.isTrue(mirrorable(await inhouse()))
  })

  test('leaves out practice against bots', async ({ assert }) => {
    assert.isFalse(mirrorable({ ...(await inhouse()), againstBots: true }))
  })

  /* `win` is not nullable: false for both sides would be a loss that never happened. */
  test('leaves out a game nobody knows the winner of', async ({ assert }) => {
    assert.isFalse(mirrorable({ ...(await inhouse()), resultKnown: false }))
  })
})

test.group('customGameIdOf', () => {
  test('reads the custom back out of a mirrored match id', ({ assert }) => {
    assert.equal(customGameIdOf(customMatchId(42)), 42)
    assert.isNull(customGameIdOf('EUW1_7996623386'))
    assert.isNull(customGameIdOf('CUSTOM_abc'))
  })
})
