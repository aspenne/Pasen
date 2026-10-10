import { describe, expect, it } from 'vitest'

import type { GroupCard } from '@/lib/api'
import { groupSignals } from '@/lib/directory'

const card: GroupCard = {
  slug: 'arigafion',
  name: 'ARIGAFION',
  members: [],
  inGame: 0,
  gamesToday: 0,
  fearless: null,
}

describe('groupSignals', () => {
  it('says the group is quiet when nothing is happening', () => {
    expect(groupSignals(card)).toEqual([{ kind: 'quiet', text: 'No game yet today' }])
  })

  it('puts who is playing first, then the day, then a fearless night', () => {
    expect(
      groupSignals({ ...card, inGame: 2, gamesToday: 14, fearless: { label: 'Vendredi', burned: 23 } })
    ).toEqual([
      { kind: 'live', text: '2 in game now' },
      { kind: 'today', text: '14 games today' },
      { kind: 'fearless', text: 'Vendredi · 23 burned' },
    ])
  })

  it('speaks in the singular for one', () => {
    expect(groupSignals({ ...card, inGame: 1, gamesToday: 1 }).map((s) => s.text)).toEqual([
      '1 in game now',
      '1 game today',
    ])
  })

  it('names an unnamed fearless night', () => {
    expect(groupSignals({ ...card, fearless: { label: null, burned: 0 } })).toContainEqual({
      kind: 'fearless',
      text: 'Fearless night · 0 burned',
    })
  })
})
