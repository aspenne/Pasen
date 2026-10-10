import { describe, expect, it } from 'vitest'

import { groupNav } from '@/lib/nav'

describe('groupNav', () => {
  it('shows the public pages to everyone', () => {
    expect(groupNav(false).map((entry) => entry.label)).toEqual(['Today', 'Insights', 'Customs', 'Fearless'])
  })

  it('adds the way back to the admin once signed in', () => {
    expect(groupNav(true).at(-1)).toMatchObject({ label: 'Admin', to: '/admin' })
  })
})
