import { describe, expect, it } from 'vitest'

import { ROLE_FILTERS, matchesRole } from '@/lib/roles'

describe('role filter', () => {
  it('offers All then the five lanes', () => {
    expect(ROLE_FILTERS.map((f) => f.label)).toEqual(['All', 'Top', 'Jungle', 'Mid', 'Bot', 'Support'])
  })

  it('keeps a champion in every lane it plays, and everyone under All', () => {
    expect(matchesRole(['TOP', 'MIDDLE'], 'MIDDLE')).toBe(true)
    expect(matchesRole(['TOP', 'MIDDLE'], 'UTILITY')).toBe(false)
    expect(matchesRole([], 'ALL')).toBe(true)
    expect(matchesRole(undefined, 'TOP')).toBe(false)
  })
})
