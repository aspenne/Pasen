import { describe, expect, it } from 'vitest'

import { availability, foldName, searchChampions, type ChampionEntry } from '@/lib/fearless'

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
