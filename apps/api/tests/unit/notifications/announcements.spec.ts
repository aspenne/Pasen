import { test } from '@japa/runner'

import {
  decayAnnouncement,
  pentakillAnnouncement,
  rankAnnouncement,
  streakAnnouncement,
} from '#notifications/announcements'
import type { RankMove } from '#ingestion/rank_service'
import type { DecayStatus } from '#stats/decay_service'

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

const decay = (over: Partial<DecayStatus> = {}): DecayStatus => ({
  daysLeft: 2,
  cap: 14,
  lpPerDay: 75,
  confident: true,
  inactive: false,
  ...over,
})

test.group('decayAnnouncement', () => {
  test('warns two days out, and says what it will cost', ({ assert }) => {
    const announcement = decayAnnouncement('froslass', 7, 'RANKED_SOLO_5x5', decay(), '2026-10-05')

    assert.equal(announcement?.kind, 'decay')
    assert.include(announcement?.text ?? '', 'in 2 days')
    assert.include(announcement?.text ?? '', '75 LP a day')
  })

  test('reads as tomorrow at one day rather than "in 1 days"', ({ assert }) => {
    const announcement = decayAnnouncement(
      'froslass',
      7,
      'RANKED_SOLO_5x5',
      decay({ daysLeft: 1 }),
      '2026-10-05'
    )

    assert.include(announcement?.text ?? '', 'tomorrow')
  })

  test('stays quiet while there is still time', ({ assert }) => {
    const announcement = decayAnnouncement(
      'froslass',
      7,
      'RANKED_SOLO_5x5',
      decay({ daysLeft: 3 }),
      '2026-10-05'
    )

    assert.isNull(announcement)
  })

  /* Already decaying is not a warning, and the warning already went out. */
  test('says nothing once the LP is already going', ({ assert }) => {
    const announcement = decayAnnouncement(
      'froslass',
      7,
      'RANKED_SOLO_5x5',
      decay({ daysLeft: 0, inactive: true }),
      '2026-10-05'
    )

    assert.isNull(announcement)
  })

  test('will not wake a channel over a number it does not trust', ({ assert }) => {
    const announcement = decayAnnouncement(
      'froslass',
      7,
      'RANKED_SOLO_5x5',
      decay({ confident: false }),
      '2026-10-05'
    )

    assert.isNull(announcement)
  })

  /*
   * The key carries the day, not the countdown. The estimate is recomputed
   * hourly; keyed on daysLeft, a standing drifting from two days to one would
   * post twice for the same piece of news.
   */
  test('keys on the day so an hourly recount posts once', ({ assert }) => {
    const twoDays = decayAnnouncement('f', 7, 'RANKED_SOLO_5x5', decay(), '2026-10-05')
    const oneDay = decayAnnouncement(
      'f',
      7,
      'RANKED_SOLO_5x5',
      decay({ daysLeft: 1 }),
      '2026-10-05'
    )

    assert.equal(twoDays?.key, oneDay?.key)
  })
})
