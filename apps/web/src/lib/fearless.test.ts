import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import {
  NIGHT_START_CHOICES,
  availability,
  foldName,
  nightSince,
  nightStartLabel,
  quickCorrection,
  searchChampions,
  type ChampionEntry,
} from '@/lib/fearless'

const champions: ChampionEntry[] = [
  { id: 103, name: 'Ahri', slug: 'Ahri' },
  { id: 145, name: "Kai'Sa", slug: 'Kaisa' },
  { id: 20, name: 'Nunu & Willump', slug: 'Nunu' },
  { id: 136, name: 'Aurelion Sol', slug: 'AurelionSol' },
  { id: 893, name: 'Aurora', slug: 'Aurora' },
]

describe('foldName', () => {
  it('drops case, accents and punctuation', () => {
    expect(foldName("Kai'Sa")).toBe('kaisa')
    expect(foldName('Nunu & Willump')).toBe('nunuwillump')
    expect(foldName('Évelynn')).toBe('evelynn')
  })
})

describe('searchChampions', () => {
  it('returns everyone, alphabetically, for an empty query', () => {
    expect(searchChampions(champions, '  ').map((c) => c.name)).toEqual([
      'Ahri',
      'Aurelion Sol',
      'Aurora',
      "Kai'Sa",
      'Nunu & Willump',
    ])
  })

  it('finds a name typed without its punctuation or accents', () => {
    expect(searchChampions(champions, 'kaisa').map((c) => c.id)).toEqual([145])
    expect(searchChampions(champions, 'nunu').map((c) => c.id)).toEqual([20])
    expect(searchChampions(champions, 'KAI').map((c) => c.id)).toEqual([145])
  })

  it('puts names that start with the query first', () => {
    expect(searchChampions(champions, 'sol').map((c) => c.name)).toEqual(['Aurelion Sol'])
    expect(searchChampions(champions, 'au').map((c) => c.name)).toEqual(['Aurelion Sol', 'Aurora'])
  })
})

describe('availability', () => {
  const ahri = champions[0]

  it('says a champion is free', () => {
    expect(availability(ahri, undefined)).toBe('Ahri is free')
  })

  it('says a champion is still burned from an earlier night', () => {
    expect(availability(ahri, { championId: 103, source: 'earlier', by: [] })).toBe(
      'Ahri is burned · played on an earlier night'
    )
  })

  it('says who played a burned champion, and when', () => {
    expect(
      availability(ahri, {
        championId: 103,
        source: 'played',
        by: [{ playerName: 'Nøah', memberSlug: null, gameNumber: 2 }],
      })
    ).toBe('Ahri is burned · played by Nøah in game 2')
  })

  it('says when it was burned by hand', () => {
    expect(availability(ahri, { championId: 103, source: 'manual', by: [] })).toBe(
      'Ahri is burned · burned by hand'
    )
  })
})

describe('api.fearless', () => {
  afterEach(() => vi.unstubAllGlobals())

  /*
   * TanStack Query treats undefined data as a failure, which made "this group
   * never ran a night" look like an outage - and an outage look like no night.
   */
  it('answers null, not undefined, when the group never ran a night', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    await expect(api.fearless('arigafion')).resolves.toBeNull()
  })
})

describe('nightSince', () => {
  it('sends nothing for now, and the moment the night began otherwise', () => {
    const now = Date.UTC(2026, 10, 8, 21, 0)
    expect(nightSince(0, now)).toBeUndefined()
    expect(nightSince(120, now)).toBe('2026-11-08T19:00:00.000Z')
  })

  it('names each choice for the select', () => {
    expect(NIGHT_START_CHOICES.map(nightStartLabel)).toEqual([
      'From now',
      'From 30 min ago',
      'From 1 h ago',
      'From 2 h ago',
      'From 3 h ago',
      'From 4 h ago',
      'From 5 h ago',
    ])
  })
})

describe('quickCorrection', () => {
  const played = { championId: 1, source: 'played' as const, by: [] }

  it('frees what a game or an earlier night burned, and burns what is free', () => {
    expect(quickCorrection(played, false)).toBe('free')
    expect(quickCorrection({ ...played, source: 'earlier' }, false)).toBe('free')
    expect(quickCorrection(undefined, false)).toBe('burn')
  })

  it('undoes a correction rather than stacking another one', () => {
    expect(quickCorrection({ ...played, source: 'manual' }, false)).toBe('forget')
    expect(quickCorrection(undefined, true)).toBe('forget')
  })
})
