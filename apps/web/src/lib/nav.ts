export type NavEntry =
  | {
      to: '/$group' | '/$group/insights' | '/$group/customs' | '/$group/fearless' | '/$group/les'
      label: string
      exact: boolean
    }
  | { to: '/admin' | '/account'; label: string; exact: boolean }

const PUBLIC: NavEntry[] = [
  { to: '/$group', label: 'Today', exact: true },
  { to: '/$group/insights', label: 'Insights', exact: false },
  { to: '/$group/customs', label: 'Customs', exact: false },
  { to: '/$group/fearless', label: 'Fearless', exact: false },
  { to: '/$group/les', label: 'LES', exact: false },
]

/**
 * The group's menu, ending on the way in: the admin for an admin, their
 * account for a member, and signing in for everyone else.
 */
export function groupNav(session?: { authenticated: boolean; admin: boolean }): NavEntry[] {
  if (session?.admin) return [...PUBLIC, { to: '/admin', label: 'Admin', exact: false }]
  if (session?.authenticated) return [...PUBLIC, { to: '/account', label: 'Account', exact: false }]
  return [...PUBLIC, { to: '/account', label: 'Sign in', exact: false }]
}
