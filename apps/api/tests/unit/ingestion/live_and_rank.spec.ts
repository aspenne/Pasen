import { test } from '@japa/runner'
import redis from '@adonisjs/redis/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'

import LeagueEntry from '#models/league_entry'
import Member from '#models/member'
import RiotAccount from '#models/riot_account'
import { LiveGameService } from '#ingestion/live_game_service'
import { RankService } from '#ingestion/rank_service'
import { RiotClient } from '#riot/client'
import type { RiotRequest, RiotRequester } from '#riot/gateway'
import type { RedisLike } from '#riot/redis'
import type { CurrentGameInfoDto, LeagueEntryDto } from '#riot/types'

function liveGame(gameId: number, puuids: string[]): CurrentGameInfoDto {
  return {
    gameId,
    gameType: 'MATCHED',
    gameStartTime: DateTime.fromISO('2026-09-16T20:00:00Z').toMillis(),
    mapId: 11,
    gameLength: 640,
    platformId: 'EUW1',
    gameMode: 'CLASSIC',
    gameQueueConfigId: 420,
    bannedChampions: [],
    participants: puuids.map((puuid, i) => ({
      puuid,
      teamId: i < puuids.length / 2 ? 100 : 200,
      championId: 100 + i,
      spell1Id: 4,
      spell2Id: 12,
      riotId: `Player${i}#EUW`,
    })),
  }
}

/** Answers spectator and league calls from a lookup keyed by puuid. */
function fakeRiot(spectator: Record<string, CurrentGameInfoDto | null>, league: LeagueEntryDto[] = []) {
  const requester: RiotRequester = {
    async request<T>(request: RiotRequest): Promise<T> {
      if (request.endpoint === 'spectator-v5.activeGame') {
        const puuid = request.path.split('/').pop()!
        const game = spectator[puuid]
        if (!game) {
          const { RiotNotFoundError } = await import('#riot/errors')
          throw new RiotNotFoundError(request.endpoint)
        }
        return game as T
      }
      return league as T
    },
  }
  return new RiotClient(requester)
}

async function makeAccount(puuid: string, overrides: Partial<RiotAccount> = {}) {
  const member = await Member.create({ slug: `m-${puuid}`, displayName: puuid })
  return RiotAccount.create({
    memberId: member.id,
    puuid,
    gameName: puuid,
    tagLine: 'EUW',
    platform: 'euw1',
    backfillState: 'done',
    ...overrides,
  })
}

const cache = () => redis.connection() as unknown as RedisLike

test.group('LiveGameService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(async () => {
    await redis.del('live:games')
  })

  test('caches the live game with all ten players and flags our own', async ({ assert }) => {
    const account = await makeAccount('alice')
    const client = fakeRiot({
      alice: liveGame(1, ['alice', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']),
    })

    const result = await new LiveGameService(client, cache()).poll([account])

    assert.equal(result.inGame, 1)

    const [game] = await new LiveGameService(client, cache()).current()
    assert.lengthOf(game.participants, 10, 'the opponents are the point of the screen')
    assert.equal(game.participants.filter((p) => p.tracked).length, 1)
    assert.equal(game.queueId, 420)
  })

  test('two members in the same game produce one card', async ({ assert }) => {
    const alice = await makeAccount('alice')
    const bob = await makeAccount('bob')
    const shared = liveGame(7, ['alice', 'bob', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'])

    const client = fakeRiot({ alice: shared, bob: shared })
    const result = await new LiveGameService(client, cache()).poll([alice, bob])

    assert.equal(result.inGame, 1)

    const [game] = await new LiveGameService(client, cache()).current()
    assert.equal(game.participants.filter((p) => p.tracked).length, 2)
  })

  test('reports an account whose game just ended so it can be synced at once', async ({
    assert,
  }) => {
    const account = await makeAccount('alice', { lastSeenLiveAt: DateTime.utc() })

    const result = await new LiveGameService(fakeRiot({}), cache()).poll([account])

    assert.lengthOf(result.justFinished, 1)
    await account.refresh()
    assert.isNull(account.lastSeenLiveAt, 'the flag must not fire twice for one game')
  })

  test('an account that was never live is not reported as finished', async ({ assert }) => {
    const account = await makeAccount('alice')

    const result = await new LiveGameService(fakeRiot({}), cache()).poll([account])

    assert.isEmpty(result.justFinished)
  })

  test('serving the live screen never calls riot', async ({ assert }) => {
    const exploding: RiotRequester = {
      async request<T>(): Promise<T> {
        throw new Error('the API must read the cache, not Riot')
      },
    }

    const games = await new LiveGameService(new RiotClient(exploding), cache()).current()
    assert.isArray(games)
  })
})

test.group('RankService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  const entry = (overrides: Partial<LeagueEntryDto> = {}): LeagueEntryDto => ({
    leagueId: 'l1',
    queueType: 'RANKED_SOLO_5x5',
    tier: 'DIAMOND',
    rank: 'III',
    puuid: 'alice',
    leaguePoints: 4,
    wins: 198,
    losses: 173,
    hotStreak: false,
    veteran: false,
    freshBlood: false,
    inactive: false,
    ...overrides,
  })

  test('records a first snapshot', async ({ assert }) => {
    const account = await makeAccount('alice')

    const result = await new RankService(fakeRiot({}, [entry()])).snapshot(account)

    assert.deepEqual(result.recorded, ['RANKED_SOLO_5x5'])
    assert.lengthOf(await LeagueEntry.all(), 1)
  })

  test('writes nothing when the standing has not moved', async ({ assert }) => {
    const account = await makeAccount('alice')
    const service = new RankService(fakeRiot({}, [entry()]))

    await service.snapshot(account)
    const result = await service.snapshot(account)

    assert.isEmpty(result.recorded)
    assert.equal(result.unchanged, 1)
    assert.lengthOf(await LeagueEntry.all(), 1, 'an hourly poll must not add a row per hour')
  })

  test('records a win that gained no lp at the top of a division', async ({ assert }) => {
    const account = await makeAccount('alice')

    await new RankService(fakeRiot({}, [entry()])).snapshot(account)
    await new RankService(fakeRiot({}, [entry({ wins: 199 })])).snapshot(account)

    assert.lengthOf(await LeagueEntry.all(), 2)
  })

  test('keeps queue types beyond solo and flex', async ({ assert }) => {
    const account = await makeAccount('alice')

    const result = await new RankService(
      fakeRiot({}, [entry(), entry({ queueType: 'RANKED_PREMADE_5x5' })])
    ).snapshot(account)

    assert.deepEqual(result.recorded, ['RANKED_SOLO_5x5', 'RANKED_PREMADE_5x5'])
  })
})
