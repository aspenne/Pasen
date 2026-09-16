import db from '@adonisjs/lucid/services/db'

import Group from '#models/group'

export type GroupChampion = {
  championId: number
  championName: string
  games: number
  wins: number
  winRate: number
  /** Who in the group plays it, most games first. */
  players: { memberSlug: string; displayName: string; games: number }[]
}

export type GroupChampionPool = {
  played: number
  available: number
  champions: GroupChampion[]
  /** Champions nobody in the group has ever picked. The group's blind spot. */
  untouched: { championId: number; championName: string }[]
}

/**
 * The roster's collective champion pool: what the group plays, who owns which
 * pick, and - the part people actually argue about - what nobody has touched.
 */
export class GroupChampionService {
  async forGroup(group: Group): Promise<GroupChampionPool> {
    const rows = await db
      .from('match_participants as p')
      .join('matches as m', 'm.match_id', 'p.match_id')
      .join('riot_accounts as a', 'a.puuid', 'p.puuid')
      .join('members as mem', 'mem.id', 'a.member_id')
      .join('group_members as g', (join) =>
        join.on('g.member_id', 'a.member_id').andOnVal('g.group_id', group.id)
      )
      .where('m.stats_eligible', true)
      .groupBy('p.champion_id', 'p.champion_name', 'mem.slug', 'mem.display_name')
      .select('p.champion_id', 'p.champion_name', 'mem.slug', 'mem.display_name')
      .count('* as games')
      .sum({ wins: db.raw('case when p.win then 1 else 0 end') })

    const champions = new Map<number, GroupChampion>()

    for (const row of rows as any[]) {
      const games = Number(row.games)
      let champion = champions.get(row.champion_id)

      if (!champion) {
        champion = {
          championId: row.champion_id,
          championName: row.champion_name,
          games: 0,
          wins: 0,
          winRate: 0,
          players: [],
        }
        champions.set(row.champion_id, champion)
      }

      champion.games += games
      champion.wins += Number(row.wins)
      champion.players.push({
        memberSlug: row.slug,
        displayName: row.display_name,
        games,
      })
    }

    for (const champion of champions.values()) {
      champion.winRate = Math.round((champion.wins / champion.games) * 1000) / 10
      champion.players.sort((a, b) => b.games - a.games)
    }

    const played = [...champions.values()].sort((a, b) => b.games - a.games)

    // The denominator and the blind spot both come from the synced roster, never
    // a constant: Riot keeps adding champions.
    const all = await db.from('static_champions').select('id', 'name').orderBy('name')

    return {
      played: played.length,
      available: all.length,
      champions: played,
      untouched: all
        .filter((champion: any) => !champions.has(champion.id))
        .map((champion: any) => ({ championId: champion.id, championName: champion.name })),
    }
  }
}
