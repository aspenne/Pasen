import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { RoleCard } from '@/components/roulette/RoleCard'
import type { RouletteCard } from '@/lib/api'
import { ROLES } from '@/lib/roulette'

const card: RouletteCard = {
  slug: 'noah',
  displayName: 'Nøah',
  tag: 'SHEN',
  tier: 'MASTER',
  rank: 'I',
  leaguePoints: 1646,
  winRate: 55.2,
  games: 736,
  championId: 98,
  championName: 'Shen',
}

describe('RoleCard', () => {
  it("shows a member's profile and their role once revealed", () => {
    render(
      <RoleCard side="blue" seat={{ puuid: 'p', name: 'Nøah#SHEN', bot: false }} card={card} role={ROLES[1]} revealed />
    )
    expect(screen.getByText('Jungle')).toBeTruthy()
    expect(screen.getByText('Master · 1646 LP')).toBeTruthy()
    expect(screen.getByText('55.2%')).toBeTruthy()
    expect(screen.getByText(/Shen/)).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Jungle' })).toBeTruthy()
  })

  it('keeps the role hidden from assistive tech until revealed', () => {
    render(<RoleCard side="red" seat={{ puuid: 'p', name: 'Nøah#SHEN', bot: false }} card={card} role={ROLES[1]} revealed={false} />)
    expect(screen.getByLabelText('Nøah, role not revealed yet')).toBeTruthy()
  })

  it('gives a guest a plain card with their lobby name', () => {
    render(<RoleCard side="blue" seat={{ puuid: 'x', name: 'Guest#EUW', bot: false }} role={ROLES[0]} revealed />)
    expect(screen.getAllByText('Guest').length).toBeGreaterThan(0)
    expect(screen.getByText('Not on Pasen')).toBeTruthy()
  })

  it('says when nobody drew a lane', () => {
    render(<RoleCard side="red" seat={null} role={ROLES[4]} revealed />)
    expect(screen.getByText('No player')).toBeTruthy()
  })

  it("names a bot after its champion, with the champion's art", () => {
    const staticData = { version: '16.20.1', champions: { '103': { slug: 'Ahri', name: 'Ahri', title: '', tags: [] } } } as never
    const { container } = render(
      <RoleCard side="red" seat={{ puuid: null, name: 'Bot', bot: true, championId: 103 }} role={ROLES[2]} revealed staticData={staticData} />
    )
    expect(screen.getAllByText('Ahri bot').length).toBeGreaterThan(0)
    expect(container.querySelector('img[src*="/champion/103/"]')).toBeTruthy()
  })
})
