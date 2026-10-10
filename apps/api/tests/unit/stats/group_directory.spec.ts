import { test } from '@japa/runner'

import { groupCard, type DirectoryAccount } from '#stats/group_directory'

const group = { slug: 'arigafion', name: 'ARIGAFION' }

function account(id: number, puuid: string, slug: string, displayName: string, icon: number | null = 1) {
  return { id, puuid, profileIconId: icon, member: { slug, displayName } } satisfies DirectoryAccount
}

test.group('groupCard', () => {
  test('lists each member once, by name, with the icon of their first account', ({ assert }) => {
    const card = groupCard(group, {
      accounts: [
        account(3, 'p3', 'noah', 'Nøah', 7),
        account(1, 'p1', 'patate', 'Patate', 29),
        account(2, 'p2', 'patate', 'Patate', 4000),
      ],
      livePuuids: new Set(),
      gamesToday: 0,
      fearless: null,
    })

    assert.deepEqual(card.members, [
      { slug: 'noah', displayName: 'Nøah', profileIconId: 7 },
      { slug: 'patate', displayName: 'Patate', profileIconId: 29 },
    ])
  })

  test('falls back to an account that has an icon', ({ assert }) => {
    const card = groupCard(group, {
      accounts: [account(1, 'p1', 'patate', 'Patate', null), account(2, 'p2', 'patate', 'Patate', 12)],
      livePuuids: new Set(),
      gamesToday: 0,
      fearless: null,
    })
    assert.equal(card.members[0].profileIconId, 12)
  })

  test('counts a member in game once, whichever account they play on', ({ assert }) => {
    const card = groupCard(group, {
      accounts: [
        account(1, 'p1', 'patate', 'Patate'),
        account(2, 'p2', 'patate', 'Patate'),
        account(3, 'p3', 'noah', 'Nøah'),
        account(4, 'p4', 'zed', 'Zed'),
      ],
      // Patate's two accounts both show up (a duo with their own smurf, say).
      livePuuids: new Set(['p1', 'p2', 'p3', 'someone-else']),
      gamesToday: 14,
      fearless: { label: 'Vendredi', burned: 23 },
    })

    assert.equal(card.inGame, 2)
    assert.equal(card.gamesToday, 14)
    assert.deepEqual(card.fearless, { label: 'Vendredi', burned: 23 })
    assert.equal(card.slug, 'arigafion')
    assert.equal(card.name, 'ARIGAFION')
  })
})
