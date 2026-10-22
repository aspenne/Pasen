import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { PreviousNames } from '@/components/admin/PreviousNames'
import { api } from '@/lib/api'

function renderIt(aliases: { id: number; riotId: string; source: 'riot' | 'manual' }[]) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PreviousNames accountId={7} riotId="Patate#CCC" aliases={aliases} />
    </QueryClientProvider>
  )
}

afterEach(() => vi.restoreAllMocks())

describe('PreviousNames', () => {
  it('lists the old Riot IDs, saying which the daily check found', () => {
    renderIt([
      { id: 1, riotId: 'Old Patate#OLD', source: 'riot' },
      { id: 2, riotId: 'Older#EUW', source: 'manual' },
    ])
    expect(screen.getByText('Old Patate#OLD')).toBeTruthy()
    expect(screen.getByTitle('Found by the daily check')).toBeTruthy()
  })

  it('adds one typed by hand', async () => {
    const add = vi.spyOn(api, 'addAlias').mockResolvedValue({ id: 3, riotId: 'Older#EUW', source: 'manual' })
    renderIt([])
    fireEvent.click(screen.getByRole('button', { name: 'Add a previous name for Patate#CCC' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Previous Riot ID' }), { target: { value: 'Older#EUW' } })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Previous Riot ID' }), { key: 'Enter' })
    await waitFor(() => expect(add).toHaveBeenCalledWith(7, 'Older#EUW'))
  })

  it('removes one', async () => {
    const remove = vi.spyOn(api, 'removeAlias').mockResolvedValue(undefined)
    renderIt([{ id: 1, riotId: 'Old Patate#OLD', source: 'riot' }])
    fireEvent.click(screen.getByRole('button', { name: 'Forget Old Patate#OLD' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith(1))
  })
})
