import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'

import Match from '#models/match'
import RiotAccount from '#models/riot_account'
import { addMember, addParticipant, seedChampions, seedGroup, seedMatch } from '#tests/helpers'

const AT = DateTime.fromISO('2026-09-16T20:00:00', { zone: 'Europe/Paris' })

/** An Arena match as Riot actually shapes it: 18 players, six subteams of three. */
async function seedArena(matchId: string, at: DateTime, roster: { puuid: string; subteam: number }[]) {
  const match = await Match.create({
    matchId,
    platform: 'EUW1',
    queueId: 1750,
    queueGroup: 'arena',
    gameMode: 'CHERRY',
    gameType: 'MATCHED_GAME',
    gameVersion: '16.18.1',
    gameCreation: at,
    gameDuration: 1400,
    gameEndedAt: at.plus({ seconds: 1400 }),
    participantCount: 18,
    statsEligible: true,
    raw: {},
    ingestedAt: DateTime.utc(),
  })

  for (const entry of roster) {
    await addParticipant(match, entry.puuid, {
      teamPosition: null,
      // Subteams 1, 2 and 6 sit on teamId 100; 3, 4 and 5 on 200. Nine players
      // share a teamId and are mostly each other's opponents.
      teamId: entry.subteam <= 2 || entry.subteam === 6 ? 100 : 200,
      subteamId: entry.subteam,
    })
  }

  return match
}

test.group('Group insights', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('pairs members who were genuinely on the same team', async ({ client, assert }) => {
    const seeded = await seedGroup()
    await addMember(seeded.group, 'nono', 'puuid-nono')

    for (let i = 0; i < 3; i++) {
      const match = await seedMatch(`EUW1_${i}`, AT.minus({ hours: i }), seeded.account.puuid)
      await addParticipant(match, 'puuid-nono', { teamId: 100 })
    }

    const response = await client.get('/api/groups/arigafion/duos')
    const body = response.body()

    assert.lengthOf(body.pairs, 1)
    assert.equal(body.pairs[0].games, 3)
    assert.equal(body.pairs[0].winRate, 100)
  })

  test('does not call two arena opponents a duo', async ({ client, assert }) => {
    const seeded = await seedGroup()
    await addMember(seeded.group, 'nono', 'puuid-nono')

    // Same teamId, different subteams: opponents, however the column reads.
    for (let i = 0; i < 4; i++) {
      await seedArena(`EUW1_arena_${i}`, AT.minus({ hours: i }), [
        { puuid: seeded.account.puuid, subteam: 1 },
        { puuid: 'puuid-nono', subteam: 2 },
      ])
    }

    const response = await client.get('/api/groups/arigafion/duos?scope=arena')

    assert.isEmpty(response.body().pairs, 'a shared teamId in Arena is not a shared team')
    assert.equal(response.body().against[0].games, 4)
  })

  test('pairs arena team-mates who share a subteam', async ({ client, assert }) => {
    const seeded = await seedGroup()
    await addMember(seeded.group, 'nono', 'puuid-nono')

    for (let i = 0; i < 3; i++) {
      await seedArena(`EUW1_arena_${i}`, AT.minus({ hours: i }), [
        { puuid: seeded.account.puuid, subteam: 3 },
        { puuid: 'puuid-nono', subteam: 3 },
      ])
    }

    const response = await client.get('/api/groups/arigafion/duos?scope=arena')
    assert.equal(response.body().pairs[0].games, 3)
  })

  test('never pairs somebody with their own smurf', async ({ client, assert }) => {
    const seeded = await seedGroup()
    await RiotAccount.create({
      memberId: seeded.member.id,
      puuid: 'puuid-smurf',
      gameName: 'Patate',
      tagLine: 'SMURF',
      platform: 'euw1',
      backfillState: 'done',
    })

    for (let i = 0; i < 4; i++) {
      const match = await seedMatch(`EUW1_${i}`, AT.minus({ hours: i }), seeded.account.puuid)
      await addParticipant(match, 'puuid-smurf', { teamId: 100 })
    }

    const response = await client.get('/api/groups/arigafion/duos')
    assert.isEmpty(response.body().pairs, 'one person is not their own duo partner')
  })

  test('withholds titles from anyone who barely turned up', async ({ client, assert }) => {
    const seeded = await seedGroup()
    await seedMatch('EUW1_1', AT, seeded.account.puuid, {}, { kills: 20, deaths: 0, assists: 20 })

    const response = await client.get('/api/groups/arigafion/leaderboards?period=all')

    assert.isEmpty(response.body().titles, 'one lucky game is not a season')
    assert.lengthOf(response.body().totals, 1, 'but the numbers are still reported')
  })

  test('awards one holder per title once people have played', async ({ client, assert }) => {
    const seeded = await seedGroup()
    const other = await addMember(seeded.group, 'nono', 'puuid-nono')

    for (let i = 0; i < 6; i++) {
      const match = await seedMatch(
        `EUW1_${i}`,
        AT.minus({ hours: i }),
        seeded.account.puuid,
        {},
        { kills: 10, deaths: 1, assists: 10 }
      )
      await addParticipant(match, other.account.puuid, { teamId: 100, kills: 1, deaths: 9 })
    }

    const response = await client.get('/api/groups/arigafion/leaderboards?period=all')
    const titles = response.body().titles as { key: string; displayName: string }[]

    assert.equal(titles.find((t) => t.key === 'warlord')?.displayName, 'Patate')
    assert.equal(titles.find((t) => t.key === 'feeder')?.displayName, 'nono')
  })

  test('lists the champions nobody in the group has touched', async ({ client, assert }) => {
    const seeded = await seedGroup()
    await seedChampions(4)

    await seedMatch('EUW1_1', AT, seeded.account.puuid, {}, { championId: 1, championName: 'Champ 1' })
    await seedMatch('EUW1_2', AT, seeded.account.puuid, {}, { championId: 3, championName: 'Champ 3' })

    const response = await client.get('/api/groups/arigafion/champions')
    const body = response.body()

    assert.equal(body.played, 2)
    assert.equal(body.available, 4)
    assert.deepEqual(
      body.untouched.map((c: any) => c.championId).sort(),
      [2, 4]
    )
  })

  test('credits a champion to everyone who plays it', async ({ client, assert }) => {
    const seeded = await seedGroup()
    const other = await addMember(seeded.group, 'nono', 'puuid-nono')
    await seedChampions(2)

    const match = await seedMatch('EUW1_1', AT, seeded.account.puuid, {}, { championId: 1 })
    await addParticipant(match, other.account.puuid, { championId: 1, teamId: 200, win: false })

    const response = await client.get('/api/groups/arigafion/champions')
    const champion = response.body().champions[0]

    assert.equal(champion.games, 2)
    assert.lengthOf(champion.players, 2)
    assert.equal(champion.winRate, 50)
  })

  test('buckets activity by the group day, not the utc day', async ({ client, assert }) => {
    const seeded = await seedGroup('Europe/Paris')
    // 00:30 Paris on the 16th is 22:30 UTC on the 15th.
    await seedMatch(
      'EUW1_late',
      DateTime.fromISO('2026-09-16T00:30:00', { zone: 'Europe/Paris' }),
      seeded.account.puuid
    )

    const response = await client.get('/api/groups/arigafion/activity')
    const days = response.body().days as { date: string; games: number }[]

    assert.equal(days[0].date, '2026-09-16')
  })

  test('never reports more wins than games were played', async ({ client, assert }) => {
    const seeded = await seedGroup()
    const other = await addMember(seeded.group, 'nono', 'puuid-nono')

    const match = await seedMatch('EUW1_duo', AT, seeded.account.puuid)
    await addParticipant(match, other.account.puuid, { teamId: 100, win: true })

    const response = await client.get('/api/groups/arigafion/activity')
    const [day] = response.body().days as { games: number; memberGames: number; wins: number }[]

    assert.equal(day.games, 1, 'a duo queue is one match')
    assert.equal(day.memberGames, 2)
    assert.equal(day.wins, 2, 'and two results')
  })
})
