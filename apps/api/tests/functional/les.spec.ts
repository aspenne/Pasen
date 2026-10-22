import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'

import LeagueEntry from '#models/league_entry'
import RiotAccount from '#models/riot_account'
import { LES_EVENT } from '#les/les_board'
import { seedGroup } from '#tests/helpers'

function reading(riotAccountId: number, capturedAt: DateTime, queueType: string, lp: number, wins: number, losses: number) {
  return LeagueEntry.create({
    riotAccountId,
    queueType,
    tier: 'DIAMOND',
    rank: 'II',
    leaguePoints: lp,
    wins,
    losses,
    hotStreak: false,
    inactive: false,
    capturedAt,
  })
}

test.group('Road to LES', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test("ranks the group's accounts by Solo/Duo LP won since the start", async ({ client, assert }) => {
    const { account } = await seedGroup()
    const start = DateTime.fromJSDate(LES_EVENT.startsAt)
    await reading(account.id, start.minus({ days: 2 }), 'RANKED_SOLO_5x5', 10, 100, 90)
    await reading(account.id, start.plus({ days: 3 }), 'RANKED_SOLO_5x5', 60, 104, 92)
    // Flex does not count.
    await reading(account.id, start.plus({ days: 3 }), 'RANKED_FLEX_SR', 99, 500, 1)

    const response = await client.get('/api/groups/arigafion/events/les')
    response.assertStatus(200)
    const [entry] = response.body().entries
    assert.equal(entry.memberSlug, 'patate')
    assert.equal(entry.riotId, 'Patate#CCC')
    assert.equal(entry.lpGained, 50)
    assert.equal(entry.games, 6)
    assert.equal(response.body().event.name, 'Lyon e-Sport')
  })

  test('404 for a group that does not exist', async ({ client }) => {
    const response = await client.get('/api/groups/nobody/events/les')
    response.assertStatus(404)
  })

  test("shows each account under its own in-game name, a smurf included", async ({ client, assert }) => {
    const { member } = await seedGroup()
    const smurf = await RiotAccount.create({ memberId: member.id, puuid: 'puuid-smurf', gameName: 'Little Potato', tagLine: 'EUW', platform: 'euw1', backfillState: 'done' })
    const start = DateTime.fromJSDate(LES_EVENT.startsAt)
    await reading(smurf.id, start.minus({ days: 1 }), 'RANKED_SOLO_5x5', 0, 0, 0)

    const entries = (await client.get('/api/groups/arigafion/events/les')).body().entries
    assert.sameMembers(entries.map((e: { displayName: string }) => e.displayName), ['Patate', 'Little Potato'])
  })
})
