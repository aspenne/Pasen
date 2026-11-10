import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import type { ReactNode } from 'react'

import { CustomGameRow } from '@/components/customs/CustomGameRow'
import type { CustomGame, CustomPlayer } from '@/lib/api'

// A plain anchor stands in for the router's link: the row is what is under test.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a href="#" className={className}>
      {children}
    </a>
  ),
}))

const player = (name: string, championName: string, kda: [number, number, number], over: Partial<CustomPlayer> = {}) =>
  ({
    riotId: `${name}#EUW`,
    name,
    isBot: false,
    memberSlug: null,
    displayName: null,
    championId: 1,
    championName,
    kills: kda[0],
    deaths: kda[1],
    assists: kda[2],
    cs: 150,
    ...over,
  }) as CustomPlayer

const game = {
  id: 37,
  label: 'Game custom 06/11/2026 Game 2',
  playedAt: '2026-11-06T21:48:52.000Z',
  duration: 1800,
  gameMode: 'CLASSIC',
  mapName: "Summoner's Rift",
  resultKnown: true,
  againstBots: false,
  teams: [
    { side: 'ORDER', won: true, kills: 31, players: [player('Nay', 'Jarvan IV', [7, 2, 11])] },
    { side: 'CHAOS', won: false, kills: 18, players: [player('Nøah', 'Sion', [3, 6, 4], { displayName: 'Noah' })] },
  ],
} as unknown as CustomGame

function renderRow() {
  return render(
    <ul>
      <CustomGameRow game={game} group="arigafion" scope="all" timezone="Europe/Paris" />
    </ul>
  )
}

describe('CustomGameRow', () => {
  it('starts folded, with the result on the line', () => {
    const { getByRole, queryByText } = renderRow()
    expect(getByRole('button', { expanded: false })).toHaveTextContent('Blue side won')
    expect(queryByText('Jarvan IV')).toBeNull()
  })

  it('unfolds into both teams: who played what, how it went, and the score line', () => {
    const { getByRole, getByText, getByLabelText } = renderRow()
    fireEvent.click(getByRole('button'))

    expect(getByRole('button', { expanded: true })).toBeInTheDocument()
    expect(getByLabelText('Blue side')).toHaveTextContent('Victory')
    expect(getByLabelText('Red side')).toHaveTextContent('Defeat')
    expect(getByText('Jarvan IV')).toBeInTheDocument()
    expect(getByText('7/2/11')).toBeInTheDocument()
    expect(getByText('Noah')).toBeInTheDocument()
    expect(getByText('Full scoreboard →')).toBeInTheDocument()

    fireEvent.click(getByRole('button', { expanded: true }))
    expect(getByRole('button', { expanded: false })).toBeInTheDocument()
  })
})
