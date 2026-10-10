import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { FearlessGrid } from '@/components/fearless/FearlessGrid'
import type { FearlessBoard, StaticData } from '@/lib/api'

const staticData = {
  version: '16.20.1',
  champions: {
    '103': { slug: 'Ahri', name: 'Ahri', title: '', tags: [] },
    '145': { slug: 'Kaisa', name: "Kai'Sa", title: '', tags: [] },
    '20': { slug: 'Nunu', name: 'Nunu & Willump', title: '', tags: [] },
  },
  summonerSpells: {},
  queues: {},
  runes: {},
} as StaticData

const board: FearlessBoard = {
  night: { id: 1, label: null, startedAt: '2026-10-10T19:00:00Z', endsAt: '2026-10-11T01:00:00Z', active: true },
  games: [],
  burned: [{ championId: 103, source: 'played', by: [{ playerName: 'Nøah', memberSlug: null, gameNumber: 1 }] }],
  freed: [],
}

function renderGrid(admin = false) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <FearlessGrid board={board} staticData={staticData} group="arigafion" admin={admin} />
    </QueryClientProvider>
  )
}

describe('FearlessGrid', () => {
  it('counts what is burned and what is left', () => {
    renderGrid()
    expect(screen.getByText('1 burned · 2 free')).toBeTruthy()
  })

  it('marks a burned champion as such for assistive tech too', () => {
    renderGrid()
    expect(screen.getByRole('button', { name: /Ahri, burned/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Kai'Sa, free/ })).toBeTruthy()
  })

  it('answers the question once the search narrows to one champion', () => {
    renderGrid()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ahri' } })
    expect(screen.getByText('Ahri is burned · played by Nøah in game 1')).toBeTruthy()
  })

  it('can hide the burned champions', () => {
    renderGrid()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide burned' }))
    expect(screen.queryByRole('button', { name: /Ahri/ })).toBeNull()
  })

  it('says who played a champion once it is selected, without corrections for a visitor', () => {
    renderGrid(false)
    fireEvent.click(screen.getByRole('button', { name: /Ahri, burned/ }))
    expect(screen.getAllByText('Ahri is burned · played by Nøah in game 1')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Free' })).toBeNull()
  })

  it('offers the corrections to an admin', () => {
    renderGrid(true)
    fireEvent.click(screen.getByRole('button', { name: /Kai'Sa, free/ }))
    expect(screen.getByRole('button', { name: 'Burn' })).toBeTruthy()
  })
})
