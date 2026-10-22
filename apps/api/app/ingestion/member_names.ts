import Member from '#models/member'

/**
 * A member is shown by their in-game name: the Riot ID of their first
 * account, without the tag. Kept in step with Riot rather than typed in, so
 * the site, the roulette and the Discord channel all call a player what the
 * game does. A member's other accounts keep their own names wherever they
 * appear one by one.
 *
 * `memberIds` limits it to some members; without, every member is checked.
 * Returns the names that changed.
 */
export async function syncMemberNames(memberIds?: number[]) {
  const query = Member.query().preload('riotAccounts', (accounts) => accounts.orderBy('id', 'asc'))
  if (memberIds) query.whereIn('id', memberIds)
  const members = await query

  const changed: { slug: string; from: string; to: string }[] = []
  for (const member of members) {
    const main = member.riotAccounts[0]
    if (!main || main.gameName === member.displayName) continue
    changed.push({ slug: member.slug, from: member.displayName, to: main.gameName })
    member.displayName = main.gameName
    await member.save()
  }
  return changed
}
