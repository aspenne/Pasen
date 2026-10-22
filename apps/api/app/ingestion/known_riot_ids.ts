import RiotAccount from '#models/riot_account'
import RiotAccountAlias from '#models/riot_account_alias'

/**
 * Every Riot ID a group's accounts are known by - the current one and every
 * name they used to have - lower-cased, to the account it belongs to. For
 * whatever Pasen only knows by name: captured customs and the roulette.
 * The current name wins where an old one has since been taken by someone else.
 */
export async function knownRiotIds(groupId: number): Promise<Map<string, RiotAccount>> {
  const accounts = await RiotAccount.query()
    .preload('member')
    .whereHas('member', (member) => member.whereHas('groups', (groups) => groups.where('groups.id', groupId)))
  if (accounts.length === 0) return new Map()

  const byId = new Map(accounts.map((account) => [account.id, account]))
  const aliases = await RiotAccountAlias.query().whereIn('riot_account_id', [...byId.keys()])

  const known = new Map<string, RiotAccount>()
  for (const alias of aliases) {
    known.set(alias.riotId.toLowerCase(), byId.get(alias.riotAccountId)!)
  }
  for (const account of accounts) {
    known.set(`${account.gameName}#${account.tagLine}`.toLowerCase(), account)
  }
  return known
}
