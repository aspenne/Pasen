import { describe, expect, it } from 'vitest'

import { PLATFORMS, accountRegionFor, isPlatform, matchRegionFor } from './platforms.js'
import { isStatsEligible, queueGroupFor } from './queues.js'

describe('riot routing', () => {
  it('routes every platform on both maps', () => {
    for (const platform of PLATFORMS) {
      expect(matchRegionFor(platform), platform).toBeDefined()
      expect(accountRegionFor(platform), platform).toBeDefined()
    }
  })

  it('keeps the sea cluster for match-v5 but folds it into asia for account-v1', () => {
    expect(matchRegionFor('sg2')).toBe('sea')
    expect(accountRegionFor('sg2')).toBe('asia')

    expect(matchRegionFor('oc1')).toBe('sea')
    expect(accountRegionFor('oc1')).toBe('asia')
  })

  it('never reports sea as an account region', () => {
    const accountRegions = new Set(PLATFORMS.map(accountRegionFor))
    expect(accountRegions.has('sea' as never)).toBe(false)
  })

  it('routes the platforms the group actually plays on', () => {
    expect(matchRegionFor('euw1')).toBe('europe')
    expect(matchRegionFor('na1')).toBe('americas')
    expect(matchRegionFor('kr')).toBe('asia')
  })

  it('narrows unknown platform strings', () => {
    expect(isPlatform('euw1')).toBe(true)
    expect(isPlatform('euw')).toBe(false)
  })
})

describe('queue grouping', () => {
  it('maps the queues the UI filters on', () => {
    expect(queueGroupFor(420)).toBe('ranked_solo')
    expect(queueGroupFor(440)).toBe('ranked_flex')
    expect(queueGroupFor(450)).toBe('aram')
    expect(queueGroupFor(1700)).toBe('arena')
  })

  it('falls back to gameMode for a queue id Riot has not published', () => {
    // 1750 is live on EUW and absent from Riot's own queues.json.
    expect(queueGroupFor(1750, 'CHERRY')).toBe('arena')
    expect(queueGroupFor(99999, 'CHERRY')).toBe('arena')
    expect(queueGroupFor(99999, 'ARAM')).toBe('aram')
  })

  it('degrades an unknown queue id instead of throwing', () => {
    expect(queueGroupFor(99999)).toBe('other')
    expect(queueGroupFor(99999, 'SOMETHING_NEW')).toBe('other')
  })

  it('excludes customs, bot games and tutorials from stats', () => {
    expect(isStatsEligible(0)).toBe(false)
    expect(isStatsEligible(830)).toBe(false)
    expect(isStatsEligible(420)).toBe(true)
    expect(isStatsEligible(1750, 'TUTORIAL')).toBe(false)
  })
})
