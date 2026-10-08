import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { CustomTitle } from '@/components/customs/CustomTitle'
import { api, type CustomGame } from '@/lib/api'

const game = {
  id: 4,
  label: 'Custom 07/08/26 Game 2',
  playedAt: '2026-10-07T20:49:00.000Z',
  duration: 2395,
  gameMode: 'CLASSIC',
  mapName: "Summoner's Rift",
  capturedBy: null,
  resultKnown: true,
  resultSource: 'capture',
  againstBots: false,
  firstBlood: null,
  teams: [],
} as unknown as CustomGame

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

afterEach(() => vi.restoreAllMocks())

describe('CustomTitle', () => {
  it('shows a plain title to anyone who is not an admin', () => {
    const { getByRole, queryByLabelText } = render(
      wrap(<CustomTitle game={game} group="arigafion" editable={false} />)
    )

    expect(getByRole('heading', { name: 'Custom 07/08/26 Game 2' })).toBeInTheDocument()
    expect(queryByLabelText('Rename this game')).toBeNull()
  })

  it('saves a new name for an admin', async () => {
    const update = vi
      .spyOn(api, 'updateCustom')
      .mockResolvedValue({ id: 4, label: 'Finale du vendredi', winnerOverride: null })

    const { getByLabelText, getByRole } = render(
      wrap(<CustomTitle game={game} group="arigafion" editable />)
    )

    fireEvent.click(getByLabelText('Rename this game'))
    fireEvent.change(getByLabelText('Name of this game'), { target: { value: '  Finale du vendredi ' } })
    fireEvent.click(getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(update).toHaveBeenCalledWith(4, { label: 'Finale du vendredi' }))
  })

  /* Clearing the name falls back to "Custom game", like an unnamed upload. */
  it('sends null when the name is emptied', async () => {
    const update = vi
      .spyOn(api, 'updateCustom')
      .mockResolvedValue({ id: 4, label: null, winnerOverride: null })

    const { getByLabelText, getByRole } = render(
      wrap(<CustomTitle game={game} group="arigafion" editable />)
    )

    fireEvent.click(getByLabelText('Rename this game'))
    fireEvent.change(getByLabelText('Name of this game'), { target: { value: '   ' } })
    fireEvent.click(getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(update).toHaveBeenCalledWith(4, { label: null }))
  })

  it('abandons the edit on Escape without saving', () => {
    const update = vi.spyOn(api, 'updateCustom')

    const { getByLabelText, getByRole } = render(
      wrap(<CustomTitle game={game} group="arigafion" editable />)
    )

    fireEvent.click(getByLabelText('Rename this game'))
    fireEvent.keyDown(getByLabelText('Name of this game'), { key: 'Escape' })

    expect(getByRole('heading', { name: 'Custom 07/08/26 Game 2' })).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })
})
