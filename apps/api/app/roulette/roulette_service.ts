import { DateTime } from 'luxon'

import CustomLobby from '#models/custom_lobby'
import Group from '#models/group'
import RiotAccount from '#models/riot_account'
import RoleDraw from '#models/role_draw'
import { drawRoles, type RoleDraw as Roles } from '#roulette/draw_roles'
import { sameTeams, type Teams } from '#roulette/lobby_teams'
import { GroupService } from '#stats/group_service'
import { PlayerStatsService } from '#stats/player_stats_service'

/** A lobby nobody has refreshed for this long is shown as the last one seen, not the live one. */
const STALE_AFTER = { minutes: 30 }

/** Long enough for every open page to have polled the draw before its first card turns. */
const REVEAL_DELAY = { seconds: 2 }

export class NoLobbyError extends Error {}

export type RouletteView = {
  serverTime: string
  lobby: {
    id: number
    source: 'capture' | 'manual'
    updatedAt: string
    stale: boolean
    teams: Teams
  } | null
  draw: { id: number; revealAt: string; roles: Roles } | null
}

export type RouletteCard = {
  slug: string
  displayName: string
  tag: string | null
  tier: string | null
  rank: string | null
  leaguePoints: number | null
  winRate: number
  games: number
  championId: number | null
  championName: string | null
}

export class RouletteService {
  async current(group: Group): Promise<CustomLobby | null> {
    return CustomLobby.query().where('group_id', group.id).orderBy('id', 'desc').first()
  }

  /**
   * A composition from the capture app or the admin. The same players as now
   * refresh the current lobby; anything else is a new lobby, without a draw -
   * roles dealt to other players mean nothing for these.
   */
  async ingest(group: Group, teams: Teams, source: 'capture' | 'manual') {
    if (source === 'manual') {
      return { lobby: await CustomLobby.create({ groupId: group.id, teams, source }), changed: true }
    }

    /*
     * The app is compared with what it last sent, not with the current lobby:
     * otherwise its next poll - three seconds after the admin moved someone -
     * would put the old composition straight back over the correction.
     */
    const current = await this.current(group)
    const lastCaptured = await CustomLobby.query()
      .where('group_id', group.id)
      .where('source', 'capture')
      .orderBy('id', 'desc')
      .first()

    if (lastCaptured && sameTeams(lastCaptured.teams, teams)) {
      lastCaptured.updatedAt = DateTime.now()
      await lastCaptured.save()
      if (current && current.id !== lastCaptured.id) {
        // The admin's correction stands; it is just as alive as the lobby it corrects.
        current.updatedAt = DateTime.now()
        await current.save()
      }
      return { lobby: current ?? lastCaptured, changed: false }
    }

    return { lobby: await CustomLobby.create({ groupId: group.id, teams, source }), changed: true }
  }

  async draw(group: Group): Promise<RoleDraw> {
    const lobby = await this.current(group)
    if (!lobby) throw new NoLobbyError('No lobby to draw roles for yet.')
    return RoleDraw.create({
      lobbyId: lobby.id,
      roles: drawRoles(lobby.teams),
      revealAt: DateTime.now().plus(REVEAL_DELAY),
    })
  }

  async view(group: Group): Promise<RouletteView> {
    const now = DateTime.now()
    const lobby = await this.current(group)
    const draw = lobby
      ? await RoleDraw.query().where('lobby_id', lobby.id).orderBy('id', 'desc').first()
      : null

    return {
      serverTime: now.toUTC().toISO()!,
      lobby: lobby
        ? {
            id: lobby.id,
            source: lobby.source,
            updatedAt: lobby.updatedAt.toUTC().toISO()!,
            stale: lobby.updatedAt < now.minus(STALE_AFTER),
            teams: lobby.teams,
          }
        : null,
      draw: draw ? { id: draw.id, revealAt: draw.revealAt.toUTC().toISO()!, roles: draw.roles } : null,
    }
  }

  /**
   * The profile card of every member in the current lobby, keyed by puuid -
   * Summoner's Rift numbers, the same the profile shows by default. A guest
   * Pasen does not track simply has no entry.
   */
  async cards(group: Group): Promise<Record<string, RouletteCard>> {
    const lobby = await this.current(group)
    if (!lobby) return {}

    const puuids = [...lobby.teams.blue, ...lobby.teams.red]
      .map((seat) => seat.puuid)
      .filter((puuid): puuid is string => puuid !== null)
    if (puuids.length === 0) return {}

    const accounts = await RiotAccount.query()
      .whereIn('puuid', puuids)
      .whereHas('member', (member) => member.whereHas('groups', (groups) => groups.where('groups.id', group.id)))
      .preload('member')
    if (accounts.length === 0) return {}

    const overview = await new GroupService().overview(group, 'rift')
    const stats = new PlayerStatsService()

    const entries = await Promise.all(
      accounts.map(async (account) => {
        const member = overview.members.find((entry) => entry.slug === account.member.slug)
        const solo = member?.ranks.find((rank) => rank.queueType === 'RANKED_SOLO_5x5')
        const top = (await stats.championPool(account.member, { scope: 'rift' })).entries[0]
        const card: RouletteCard = {
          slug: account.member.slug,
          displayName: account.member.displayName,
          tag: account.tagLine,
          tier: solo?.tier ?? null,
          rank: solo?.rank ?? null,
          leaguePoints: solo?.leaguePoints ?? null,
          winRate: member?.totals.winRate ?? 0,
          games: member?.totals.games ?? 0,
          championId: top?.championId ?? null,
          championName: top?.championName ?? null,
        }
        return [account.puuid, card] as const
      })
    )
    return Object.fromEntries(entries)
  }
}
