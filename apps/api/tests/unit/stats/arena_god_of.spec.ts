import { test } from '@japa/runner'

import { arenaGodOf } from '#stats/group_service'

test.group('arenaGodOf', () => {
  test('takes the best of a member’s accounts, and is null until one is known', ({ assert }) => {
    assert.equal(arenaGodOf([{ arenaGod: 12 }, { arenaGod: 31 }, { arenaGod: null }]), 31)
    assert.equal(arenaGodOf([{ arenaGod: 0 }]), 0)
    assert.isNull(arenaGodOf([{ arenaGod: null }]))
    assert.isNull(arenaGodOf([]))
  })
})
