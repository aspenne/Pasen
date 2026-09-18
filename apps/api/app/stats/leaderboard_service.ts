import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import Group from '#models/group'
import { DEFAULT_SCOPE, applyScope, type QueueScope } from '#stats/scope'

export type LeaderboardPeriod = 'week' | 'month' | 'all'

export type MemberTotals = {
  memberSlug: string
  displayName: string
  games: number
  wins: number
  winRate: number
  kills: number
  deaths: number
  assists: number
  kda: number
  csPerMinute: number
  visionPerGame: number
  deathsPerGame: number
  pentaKills: number
  lateNightGames: number
  championsPlayed: number
}

export type Board = {
  key: string
  label: string
  /** Rendered after the value: '%', '/min', or nothing. */
  unit: string
  entries: { memberSlug: string; displayName: string; value: number }[]
}

export type Title = {
  key: string
  label: string
  description: string
  memberSlug: string
  displayName: string
  detail: string
}

export type Leaderboards = {
  period: LeaderboardPeriod
  from: string | null
  to: string
  /** Below this, nobody is eligible for a title: one lucky game is not a season. */
  minimumGames: number
  totals: MemberTotals[]
  boards: Board[]
  titles: Title[]
}

const MINIMUM_GAMES = 5

export class LeaderboardService {
  async forGroup(
    group: Group,
    period: LeaderboardPeriod = 'week',
    scope: QueueScope = DEFAULT_SCOPE
  ): Promise<Leaderboards> {
    const now = DateTime.now().setZone(group.timezone)
    const from =
      period === 'all'
        ? null
        : period === 'week'
          ? now.minus({ days: 7 }).startOf('day')
          : now.minus({ days: 30 }).startOf('day')

    const totals = await this.#totals(group, from, scope)
    const eligible = totals.filter((member) => member.games >= MINIMUM_GAMES)

    return {
      period,
      from: from?.toISO() ?? null,
      to: now.toISO()!,
      minimumGames: MINIMUM_GAMES,
      totals,
      boards: this.#boards(totals),
      titles: this.#titles(eligible),
    }
  }

  async #totals(
    group: Group,
    from: DateTime | null,
    scope: QueueScope
  ): Promise<MemberTotals[]> {
    const query = db
      .from('match_participants as p')
      .join('matches as m', 'm.match_id', 'p.match_id')
      .join('riot_accounts as a', 'a.puuid', 'p.puuid')
      .join('members as mem', 'mem.id', 'a.member_id')
      .join('group_members as g', (join) =>
        join.on('g.member_id', 'a.member_id').andOnVal('g.group_id', group.id)
      )
      .where('m.stats_eligible', true)
      .if(from, (query) => query.andWhere('m.game_creation', '>=', from!.toUTC().toSQL()!))
      .groupBy('mem.slug', 'mem.display_name')
      .select('mem.slug', 'mem.display_name')
      .count('* as games')
      .sum({ wins: db.raw('case when p.win then 1 else 0 end') })
      .sum({ kills: 'p.kills' })
      .sum({ deaths: 'p.deaths' })
      .sum({ assists: 'p.assists' })
      .sum({ cs: 'p.cs' })
      .sum({ vision: 'p.vision_score' })
      .sum({ pentas: 'p.penta_kills' })
      .sum({ seconds: 'm.game_duration' })
      .countDistinct('p.champion_id as champions')
      .sum({
        // Hour of day in the group's own timezone: "late night" is a local idea,
        // and a UTC hour would be wrong for everyone but Britain in winter.
        late_night: db.raw(
          `case when extract(hour from m.game_creation at time zone ?) < 5 then 1 else 0 end`,
          [group.timezone]
        ),
      })

    applyScope(query, scope)
    const rows = await query

    return rows
      .map((row: any) => {
        const games = Number(row.games)
        const deaths = Number(row.deaths)
        const minutes = Number(row.seconds) / 60

        return {
          memberSlug: row.slug,
          displayName: row.display_name,
          games,
          wins: Number(row.wins),
          winRate: round1((Number(row.wins) / games) * 100),
          kills: Number(row.kills),
          deaths,
          assists: Number(row.assists),
          // A deathless stretch is a perfect ratio, not a division by zero.
          kda: round2((Number(row.kills) + Number(row.assists)) / Math.max(deaths, 1)),
          csPerMinute: minutes > 0 ? round1(Number(row.cs) / minutes) : 0,
          visionPerGame: round1(Number(row.vision) / games),
          deathsPerGame: round1(deaths / games),
          pentaKills: Number(row.pentas),
          lateNightGames: Number(row.late_night),
          championsPlayed: Number(row.champions),
        }
      })
      .sort((a, b) => b.games - a.games)
  }

  #boards(totals: MemberTotals[]): Board[] {
    const board = (
      key: string,
      label: string,
      unit: string,
      pick: (member: MemberTotals) => number
    ): Board => ({
      key,
      label,
      unit,
      entries: [...totals]
        .map((member) => ({
          memberSlug: member.memberSlug,
          displayName: member.displayName,
          value: pick(member),
        }))
        .sort((a, b) => b.value - a.value),
    })

    return [
      board('games', 'Games played', '', (m) => m.games),
      board('winRate', 'Win rate', '%', (m) => m.winRate),
      board('kda', 'KDA', '', (m) => m.kda),
      board('csPerMinute', 'CS per minute', '/min', (m) => m.csPerMinute),
      board('visionPerGame', 'Vision score', '/game', (m) => m.visionPerGame),
      board('deathsPerGame', 'Deaths', '/game', (m) => m.deathsPerGame),
      board('championsPlayed', 'Champions played', '', (m) => m.championsPlayed),
    ]
  }

  /**
   * One holder each, awarded only to someone who actually turned up. Every title
   * carries the number behind it, so nobody has to take the site's word for it.
   */
  #titles(eligible: MemberTotals[]): Title[] {
    if (eligible.length === 0) {
      return []
    }

    const best = (pick: (member: MemberTotals) => number) =>
      eligible.reduce((leader, member) => (pick(member) > pick(leader) ? member : leader))

    const titles: Title[] = [
      title('warlord', 'Warlord', 'Best KDA', best((m) => m.kda), (m) => `${m.kda} KDA`),
      title('feeder', 'The Feeder', 'Most deaths per game', best((m) => m.deathsPerGame), (m) => `${m.deathsPerGame} deaths a game`),
      title('lighthouse', 'Lighthouse', 'Most vision score', best((m) => m.visionPerGame), (m) => `${m.visionPerGame} vision a game`),
      title('farmhand', 'Farmhand', 'Best CS per minute', best((m) => m.csPerMinute), (m) => `${m.csPerMinute} CS a minute`),
      title('workhorse', 'Workhorse', 'Most games played', best((m) => m.games), (m) => `${m.games} games`),
      title('collector', 'The Collector', 'Most different champions', best((m) => m.championsPlayed), (m) => `${m.championsPlayed} champions`),
    ]

    // Conditional titles: awarding "Night owl" to someone who never played at
    // 3am would make every title meaningless.
    const nightOwl = best((m) => m.lateNightGames)
    if (nightOwl.lateNightGames > 0) {
      titles.push(
        title('night-owl', 'Night owl', 'Most games after midnight', nightOwl, (m) => `${m.lateNightGames} games past midnight`)
      )
    }

    const executioner = best((m) => m.pentaKills)
    if (executioner.pentaKills > 0) {
      titles.push(
        title('executioner', 'Executioner', 'Most pentakills', executioner, (m) => `${m.pentaKills} pentakill${m.pentaKills > 1 ? 's' : ''}`)
      )
    }

    return titles
  }
}

function title(
  key: string,
  label: string,
  description: string,
  member: MemberTotals,
  detail: (member: MemberTotals) => string
): Title {
  return {
    key,
    label,
    description,
    memberSlug: member.memberSlug,
    displayName: member.displayName,
    detail: detail(member),
  }
}

const round1 = (value: number) => Math.round(value * 10) / 10
const round2 = (value: number) => Math.round(value * 100) / 100
