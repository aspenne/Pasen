import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import { ArenaGodService } from '#ingestion/arena_god_service'
import { RiotApiError } from '#riot/errors'
import type { PlayerChallengesDto } from '#riot/types'
import { seedGroup } from '#tests/helpers'

/** A Riot client whose challenges endpoint answers with `reply`, or throws it. */
function riotAnswering(reply: PlayerChallengesDto | Error) {
  return {
    challenges: {
      playerData: async () => {
        if (reply instanceof Error) throw reply
        return reply
      },
    },
  } as unknown as ConstructorParameters<typeof ArenaGodService>[0]
}

test.group('ArenaGodService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('keeps Riot’s count of champions placed first with', async ({ assert }) => {
    const { account } = await seedGroup()
    const riot = riotAnswering({
      challenges: [
        { challengeId: 101000, value: 999, level: 'GOLD', percentile: 0.2 },
        { challengeId: 602002, value: 23, level: 'GOLD', percentile: 0.1 },
      ],
    })

    assert.equal(await new ArenaGodService(riot).refresh(account), 'updated')
    await account.refresh()
    assert.equal(account.arenaGod, 23)
    assert.isNotNull(account.arenaGodCheckedAt)
  })

  test('counts an account that never won an Arena as zero, not unknown', async ({ assert }) => {
    const { account } = await seedGroup()
    await new ArenaGodService(riotAnswering({ challenges: [] })).refresh(account)
    await account.refresh()
    assert.equal(account.arenaGod, 0)
  })

  test('leaves the value alone when the key cannot read challenges', async ({ assert }) => {
    const { account } = await seedGroup()
    account.arenaGod = 12
    await account.save()

    const refused = new RiotApiError(403, 'challenges-v1.playerData', 'Not entitled')
    assert.equal(await new ArenaGodService(riotAnswering(refused)).refresh(account), 'not-entitled')
    await account.refresh()
    assert.equal(account.arenaGod, 12)
  })
})
