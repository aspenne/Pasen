import { test } from '@japa/runner'

import {
  pentakillAnnouncement,
  rankAnnouncement,
  streakAnnouncement,
} from '#notifications/announcements'
import type { RankMove } from '#ingestion/rank_service'

const move = (over: Partial<RankMove> = {}): RankMove => ({
  queueType: 'RANKED_SOLO_5x5',
  from: { tier: 'DIAMOND', rank: 'I' },
  to: { tier: 'MASTER', rank: 'I' },
  leaguePoints: 12,
  promotion: true,
  ...over,
})

test.group('announcements', () => {
  test('announces a promotion, dropping the division where it means nothing', ({ assert }) => {
    const announcement = rankAnnouncement('Nøah', 1, move(), '2026-09-23')

    assert.equal(announcement?.kind, 'promotion')
    assert.include(announcement?.text, '**Master**')
    assert.include(announcement?.text, 'Diamond I')
    assert.include(announcement?.text, 'solo queue')
  })

  test('announces a drop in its own words', ({ assert }) => {
    const announcement = rankAnnouncement(
      'Azizes',
      1,
      move({
        from: { tier: 'MASTER', rank: 'I' },
        to: { tier: 'DIAMOND', rank: 'I' },
        promotion: false,
      }),
      '2026-09-23'
    )

    assert.equal(announcement?.kind, 'demotion')
    assert.include(announcement?.text, 'dropped')
  })

  test('says nothing the first time a standing is seen', ({ assert }) => {
    // No previous row means we had not looked before, not that they climbed.
    assert.isNull(rankAnnouncement('froslass', 1, move({ from: null }), '2026-09-23'))
  })

  test('keys a rank move by the day, so an evening of yo-yo says it once', ({ assert }) => {
    const first = rankAnnouncement('Nøah', 1, move(), '2026-09-23')
    const again = rankAnnouncement('Nøah', 1, move(), '2026-09-23')
    const tomorrow = rankAnnouncement('Nøah', 1, move(), '2026-09-24')

    assert.equal(first?.key, again?.key)
    assert.notEqual(first?.key, tomorrow?.key)
  })

  test('keys a pentakill to the game, not the moment', ({ assert }) => {
    // The same game is ingested once per member who was in it.
    const a = pentakillAnnouncement('koko', 'Milio', 'EUW1_1', 'puuid-1')
    const b = pentakillAnnouncement('koko', 'Milio', 'EUW1_1', 'puuid-1')

    assert.equal(a.key, b.key)
    assert.equal(a.key, 'penta:EUW1_1:puuid-1')
  })

  test('announces a streak at five and then every five', ({ assert }) => {
    assert.isNull(streakAnnouncement('MATIOU GOAT', 4, 'EUW1_1', 1))
    assert.isNotNull(streakAnnouncement('MATIOU GOAT', 5, 'EUW1_1', 1))
    assert.isNull(streakAnnouncement('MATIOU GOAT', 7, 'EUW1_1', 1))
    assert.isNotNull(streakAnnouncement('MATIOU GOAT', 10, 'EUW1_1', 1))
  })
})
