import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import Group from '#models/group'

export type ActivityDay = {
  /** ISO date in the group's timezone. */
  date: string
  /** Distinct matches. A five-stack counts once. */
  games: number
  /** Member participations. A five-stack counts five. */
  memberGames: number
  /** Wins over participations, so it can never exceed memberGames. */
  wins: number
}

/**
 * Games per day, for the activity calendar.
 *
 * Bucketed in the group's own timezone inside the query, so a 01:00 game counts
 * against the evening it belongs to - the same rule the daily feed uses, and it
 * has to agree with it or the calendar and the feed will disagree by one game.
 */
export class ActivityService {
  async forGroup(group: Group, days = 365): Promise<ActivityDay[]> {
    const since = DateTime.now().setZone(group.timezone).minus({ days }).startOf('day')

    const rows = await db
      .from('matches as m')
      .join('match_participants as p', 'p.match_id', 'm.match_id')
      .join('riot_accounts as a', 'a.puuid', 'p.puuid')
      .join('group_members as g', (join) =>
        join.on('g.member_id', 'a.member_id').andOnVal('g.group_id', group.id)
      )
      .where('m.game_creation', '>=', since.toUTC().toSQL()!)
      /*
       * Grouped by the output alias, not by a repeat of the expression. Bound
       * parameters get separate placeholders each time they appear, and Postgres
       * will not accept `group by (x at time zone $4)` as matching
       * `select (x at time zone $1)` even when the values are identical.
       */
      .select(db.raw('(m.game_creation at time zone ?)::date as day', [group.timezone]))
      .groupByRaw('day')
      /*
       * Two units, named as such. Counting matches but summing wins over
       * participations produced days with more wins than games - a five-stack is
       * one match and five results. These match the daily feed's definitions on
       * purpose: a calendar that disagrees with the page it links to is worse
       * than no calendar.
       */
      .countDistinct('m.match_id as games')
      .count('* as member_games')
      .sum({ wins: db.raw('case when p.win then 1 else 0 end') })
      .orderBy('day', 'asc')

    return (rows as any[]).map((row) => ({
      date: DateTime.fromJSDate(new Date(row.day)).toISODate()!,
      games: Number(row.games),
      memberGames: Number(row.member_games),
      wins: Number(row.wins),
    }))
  }
}
