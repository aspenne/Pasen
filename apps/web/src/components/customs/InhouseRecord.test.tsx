import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { InhouseRecord } from '@/components/customs/InhouseRecord'

describe('InhouseRecord', () => {
  it('states the record and the place in the wins table', () => {
    render(<InhouseRecord record={{ wins: 5, losses: 4, games: 9, winRate: 55.6, place: 2, of: 11 }} />)
    expect(screen.getByText('5W 4L')).toBeTruthy()
    expect(screen.getByText('55.6%')).toBeTruthy()
    expect(screen.getByText('#2 of 11')).toBeTruthy()
  })

  it('says so before the first settled custom', () => {
    render(<InhouseRecord record={null} />)
    expect(screen.getByText(/No settled custom yet/)).toBeTruthy()
  })
})
