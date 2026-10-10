import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { TeamEditor } from '@/components/roulette/TeamEditor'

const seat = (name: string) => ({ puuid: `p-${name}`, name, bot: false })
const members = [
  { slug: 'noah', displayName: 'Nøah', riotId: 'Nøah#SHEN' },
  { slug: 'chaf', displayName: 'CHAF', riotId: 'CHAF#CCC' },
]

describe('TeamEditor', () => {
  it('moves a player across, removes one, adds a member, then saves', () => {
    const onSave = vi.fn()
    render(
      <TeamEditor
        teams={{ blue: [seat('A#1'), seat('B#2')], red: [seat('C#3')] }}
        members={members}
        onSave={onSave}
        saving={false}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Move A to red' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove C' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Member to add' }), { target: { value: 'noah' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add to blue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save teams' }))

    expect(onSave).toHaveBeenCalledWith({
      blue: [seat('B#2'), { puuid: null, name: 'Nøah#SHEN', bot: false }],
      red: [seat('A#1')],
    })
  })

  it('does not offer a member who is already in the lobby', () => {
    render(
      <TeamEditor
        teams={{ blue: [{ puuid: 'x', name: 'Nøah#SHEN', bot: false }], red: [] }}
        members={members}
        onSave={vi.fn()}
        saving={false}
      />
    )
    expect(screen.queryByRole('option', { name: 'Nøah' })).toBeNull()
    expect(screen.getByRole('option', { name: 'CHAF' })).toBeTruthy()
  })
})
