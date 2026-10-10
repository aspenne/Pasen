import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'

import Group from '#models/group'
import RiotAccount from '#models/riot_account'
import { FearlessService } from '#fearless/fearless_service'
import { groupCard, type GroupCard } from '#stats/group_directory'

/**
 * Feeds the front page. Reads only our own tables and the live cache the
 * spectator poll already fills - never Riot - so the page costs no API budget
 * however often it is opened.
 */
export class GroupDirectoryService {
  constructor(private readonly livePuuids: () => Promise<Set<string>>) {}

  async cards(): Promise<GroupCard[]> {
    const [groups, live] = await Promise.all([
      Group.query().orderBy('name', 'asc'),
      // The front page is a way in, not a status board: a cold cache shows nobody live.
      this.livePuuids().catch((error) => {
        logger.warn({ err: error }, 'live cache unavailable for the group directory')
        return new Set<string>()
      }),
    ])

    return Promise.all(
      groups.map(async (group) => {
        const accounts = await RiotAccount.query()
          .join('group_members as gm', 'gm.member_id', 'riot_accounts.member_id')
          .where('gm.group_id', group.id)
          .preload('member')
          .select('riot_accounts.*')

        return groupCard(group, {
          accounts: accounts.map((account) => ({
            id: account.id,
            puuid: account.puuid,
            profileIconId: account.profileIconId,
            member: { slug: account.member.slug, displayName: account.member.displayName },
          })),
          livePuuids: live,
          gamesToday: await this.#gamesToday(group, accounts.map((account) => account.puuid)),
          fearless: await this.#fearless(group),
        })
      })
    )
  }

  /** Games started since midnight where the group lives. */
  async #gamesToday(group: Group, puuids: string[]): Promise<number> {
    if (puuids.length === 0) return 0
    const since = DateTime.now().setZone(group.timezone).startOf('day').toUTC().toISO()!

    const [row] = await db
      .from('match_participants as mp')
      .join('matches as m', 'm.match_id', 'mp.match_id')
      .whereIn('mp.puuid', puuids)
      .where('m.game_creation', '>=', since)
      .countDistinct('mp.match_id as games')

    return Number(row.games)
  }

  async #fearless(group: Group): Promise<GroupCard['fearless']> {
    const service = new FearlessService()
    const night = await service.latest(group)
    if (!night) return null
    const board = await service.board(night)
    return board.night.active ? { label: board.night.label, burned: board.burned.length } : null
  }
}
