import { describe, expect, it } from 'vitest'

import { groupNav } from '@/lib/nav'

describe('groupNav', () => {
  it('shows the public pages to everyone, and the way to sign in', () => {
    expect(groupNav(undefined).map((entry) => entry.label)).toEqual([
      'Today',
      'Insights',
      'Customs',
      'Fearless',
      'LES',
      'Sign in',
    ])
    expect(groupNav({ authenticated: false, admin: false }).at(-1)).toMatchObject({ to: '/account' })
  })

  it('leads a member to their account', () => {
    expect(groupNav({ authenticated: true, admin: false }).at(-1)).toMatchObject({ label: 'Account', to: '/account' })
  })

  it('leads an admin back to the admin', () => {
    expect(groupNav({ authenticated: true, admin: true }).at(-1)).toMatchObject({ label: 'Admin', to: '/admin' })
  })
})
