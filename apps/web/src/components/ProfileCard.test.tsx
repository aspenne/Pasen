import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ProfileCard } from '@/components/ProfileCard'
import type { ProfileCardStats } from '@/lib/api'

const card = {
  mainRole: 'UTILITY',
  roleShare: 44,
  hoursPlayed: 4.8,
  killParticipation: 58.5,
  bestStreak: 3,
  bestMultikill: null,
  bestChampion: null,
} as unknown as ProfileCardStats

describe('ProfileCard', () => {
  it('names the games its win rate is about, not always ranked solo', () => {
    render(
      <ProfileCard
        name="Nøah"
        tagLine="SHEN"
        rank={null}
        peakLp={null}
        totals={{ games: 9, wins: 5, winRate: 55.6, kda: 3.88, csPerMinute: 5.2 }}
        card={card}
        scopeLabel="Customs"
      />
    )
    expect(screen.getByText('customs')).toBeTruthy()
    expect(screen.queryByText('ranked solo')).toBeNull()
  })
})
