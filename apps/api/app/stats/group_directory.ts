/**
 * One card per group for the site's front page: who is in it, and what is
 * happening there right now. Pure, so the rules - a member counted once
 * however many accounts they play on, the icon of their first account - are
 * tested without a database or a live cache.
 */

export type DirectoryAccount = {
  id: number
  puuid: string
  profileIconId: number | null
  member: { slug: string; displayName: string }
}

export type GroupCard = {
  slug: string
  name: string
  members: { slug: string; displayName: string; profileIconId: number | null }[]
  /** Members in a game right now, each counted once. */
  inGame: number
  /** Games the group's accounts started today, in the group's timezone. */
  gamesToday: number
  /** The fearless night in progress, if one is. */
  fearless: { label: string | null; burned: number } | null
}

export function groupCard(
  group: { slug: string; name: string },
  input: {
    accounts: DirectoryAccount[]
    livePuuids: Set<string>
    gamesToday: number
    fearless: GroupCard['fearless']
  }
): GroupCard {
  // Oldest account first: the one a member was added with is their main.
  const accounts = [...input.accounts].sort((a, b) => a.id - b.id)

  const members = new Map<string, GroupCard['members'][number]>()
  const inGame = new Set<string>()

  for (const account of accounts) {
    const known = members.get(account.member.slug)
    if (!known) {
      members.set(account.member.slug, {
        slug: account.member.slug,
        displayName: account.member.displayName,
        profileIconId: account.profileIconId,
      })
    } else if (known.profileIconId === null) {
      known.profileIconId = account.profileIconId
    }

    if (input.livePuuids.has(account.puuid)) inGame.add(account.member.slug)
  }

  return {
    slug: group.slug,
    name: group.name,
    members: [...members.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, 'en')),
    inGame: inGame.size,
    gamesToday: input.gamesToday,
    fearless: input.fearless,
  }
}
