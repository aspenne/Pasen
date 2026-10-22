import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { MainAccount } from '@/components/admin/MainAccount'
import { api } from '@/lib/api'

const wrap = (node: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>)

afterEach(() => vi.restoreAllMocks())

describe('MainAccount', () => {
  it('marks the account the member is named after', () => {
    wrap(<MainAccount accountId={1} riotId="Aspenne#CUTIE" isMain siblings={2} />)
    expect(screen.getByText('main')).toBeTruthy()
  })

  it('says nothing for a member with a single account', () => {
    const { container } = wrap(<MainAccount accountId={1} riotId="Aspenne#CUTIE" isMain siblings={1} />)
    expect(container.textContent).toBe('')
  })

  it('makes another account the main one', async () => {
    const set = vi.spyOn(api, 'setMainAccount').mockResolvedValue({ slug: 'x', displayName: 'Smurf' })
    wrap(<MainAccount accountId={2} riotId="Smurf#EUW" isMain={false} siblings={2} />)
    fireEvent.click(screen.getByRole('button', { name: 'Name the member after Smurf#EUW' }))
    await waitFor(() => expect(set).toHaveBeenCalledWith(2))
  })
})
