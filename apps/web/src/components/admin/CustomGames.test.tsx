import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { CustomGames } from '@/components/admin/CustomGames'
import { api, type CustomGameSummary } from '@/lib/api'

const base = {
  playedAt: '2026-10-10T20:00:00.000Z',
  duration: 1800,
  gameMode: 'CLASSIC',
  mapName: "Summoner's Rift",
  playerCount: 10,
  againstBots: false,
}

const games: CustomGameSummary[] = [
  { ...base, id: 11, label: 'Game 4', resultKnown: false, resultSource: null, winner: null },
  { ...base, id: 12, label: 'Game 5', resultKnown: true, resultSource: 'capture', winner: 'CHAOS' },
]

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CustomGames group="arigafion" />
    </QueryClientProvider>
  )
}

afterEach(() => vi.restoreAllMocks())

describe('CustomGames (admin)', () => {
  it('flags the games nobody settled', async () => {
    vi.spyOn(api, 'customs').mockResolvedValue(games)
    renderCard()
    expect(await screen.findByText('No result')).toBeTruthy()
    expect(screen.getAllByText('No result')).toHaveLength(1)
  })

  it('decides the winner from the list', async () => {
    vi.spyOn(api, 'customs').mockResolvedValue(games)
    const update = vi
      .spyOn(api, 'updateCustom')
      .mockResolvedValue({ id: 11, label: 'Game 4', winnerOverride: 'ORDER' })
    renderCard()

    fireEvent.click(await screen.findByRole('button', { name: 'Blue won: Game 4' }))
    await waitFor(() => expect(update).toHaveBeenCalledWith(11, { winner: 'ORDER' }))
  })

  it('shows the side that won as chosen', async () => {
    vi.spyOn(api, 'customs').mockResolvedValue(games)
    renderCard()
    const red = await screen.findByRole('button', { name: 'Red won: Game 5' })
    expect(red.getAttribute('aria-pressed')).toBe('true')
  })

  it('renames a game from the list', async () => {
    vi.spyOn(api, 'customs').mockResolvedValue(games)
    const update = vi
      .spyOn(api, 'updateCustom')
      .mockResolvedValue({ id: 11, label: 'Finale', winnerOverride: null })
    renderCard()

    fireEvent.click(await screen.findByRole('button', { name: 'Rename Game 4' }))
    const input = screen.getByRole('textbox', { name: 'New name for Game 4' })
    fireEvent.change(input, { target: { value: '  Finale ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(update).toHaveBeenCalledWith(11, { label: 'Finale' }))
  })

  it('leaves the name alone on Escape', async () => {
    vi.spyOn(api, 'customs').mockResolvedValue(games)
    const update = vi.spyOn(api, 'updateCustom')
    renderCard()

    fireEvent.click(await screen.findByRole('button', { name: 'Rename Game 4' }))
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'New name for Game 4' }), { key: 'Escape' })
    expect(screen.queryByRole('textbox', { name: 'New name for Game 4' })).toBeNull()
    expect(update).not.toHaveBeenCalled()
  })
})
