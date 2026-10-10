export type NavEntry =
  | { to: '/$group' | '/$group/insights' | '/$group/customs' | '/$group/fearless'; label: string; exact: boolean }
  | { to: '/admin'; label: string; exact: boolean }

const PUBLIC: NavEntry[] = [
  { to: '/$group', label: 'Today', exact: true },
  { to: '/$group/insights', label: 'Insights', exact: false },
  { to: '/$group/customs', label: 'Customs', exact: false },
  { to: '/$group/fearless', label: 'Fearless', exact: false },
]

/** The group's menu; signed in, it also leads back to the admin. */
export function groupNav(authenticated: boolean): NavEntry[] {
  return authenticated ? [...PUBLIC, { to: '/admin', label: 'Admin', exact: false }] : PUBLIC
}
