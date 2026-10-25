import { test } from '@japa/runner'

import { championRoles } from '#static_data/champion_roles'

const meraki = {
  Ahri: { id: 103, positions: ['MIDDLE'] },
  Pantheon: { id: 80, positions: ['JUNGLE', 'MIDDLE', 'SUPPORT', 'TOP'] },
  Yunara: { id: 804, positions: ['BOTTOM'] },
}

test.group('championRoles', () => {
  test("takes each champion's roles from Meraki, in lane order, Support as UTILITY", ({ assert }) => {
    const roles = championRoles([103, 80, 804], meraki, new Map())
    assert.deepEqual(roles.get(103), ['MIDDLE'])
    assert.deepEqual(roles.get(80), ['TOP', 'JUNGLE', 'MIDDLE', 'UTILITY'])
    assert.deepEqual(roles.get(804), ['BOTTOM'])
  })

  test('falls back to where the games stored play a champion Meraki does not know yet', ({ assert }) => {
    const played = new Map([
      [999, [{ position: 'TOP', games: 7 }, { position: 'JUNGLE', games: 2 }]],
      [998, [{ position: 'MIDDLE', games: 2 }]],
    ])
    const roles = championRoles([103, 999, 998], meraki, played)
    assert.deepEqual(roles.get(999), ['TOP'])
    // Two games is not enough to call it a role.
    assert.deepEqual(roles.get(998), [])
  })

  test('ignores roles it does not know', ({ assert }) => {
    const roles = championRoles([1], { X: { id: 1, positions: ['MIDDLE', 'APEX'] } }, new Map())
    assert.deepEqual(roles.get(1), ['MIDDLE'])
  })
})
