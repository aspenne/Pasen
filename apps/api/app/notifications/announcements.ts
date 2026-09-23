import type { Announcement } from '#notifications/discord_service'
import type { RankMove } from '#ingestion/rank_service'

const QUEUE_NAMES: Record<string, string> = {
  RANKED_SOLO_5x5: 'solo queue',
  RANKED_FLEX_SR: 'flex',
  RANKED_PREMADE_5x5: 'ranked 5v5',
}

/** "Master I" for the ranked tiers, "Master" where the division means nothing. */
function standing(tier: string, division: string | null): string {
  const name = tier.charAt(0) + tier.slice(1).toLowerCase()
  const apex = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier.toUpperCase())
  return apex || !division ? name : `${name} ${division}`
}

/**
 * A standing that changed division or tier.
 *
 * Keyed by the day as well as the transition: someone bouncing over the same
 * boundary twice in an evening is not two pieces of news, but the same climb
 * next week is.
 */
export function rankAnnouncement(
  displayName: string,
  accountId: number,
  move: RankMove,
  day: string
): Announcement | null {
  if (!move.from?.tier) return null

  const queue = QUEUE_NAMES[move.queueType] ?? move.queueType.replace(/_/g, ' ').toLowerCase()
  const to = standing(move.to.tier, move.to.rank)
  const from = standing(move.from.tier, move.from.rank)

  return {
    key: `rank:${accountId}:${move.queueType}:${from}>${to}:${day}`,
    kind: move.promotion ? 'promotion' : 'demotion',
    text: move.promotion
      ? `**${displayName}** is now **${to}** in ${queue}, up from ${from}.`
      : `**${displayName}** dropped to ${to} in ${queue}, from ${from}.`,
  }
}

/** Rare enough to be worth saying every time, and tied to the game it happened in. */
export function pentakillAnnouncement(
  displayName: string,
  championName: string,
  matchId: string,
  puuid: string
): Announcement {
  return {
    key: `penta:${matchId}:${puuid}`,
    kind: 'pentakill',
    text: `**${displayName}** got a pentakill on ${championName}.`,
  }
}

/** Announced at five and then every five, so a long run does not post nightly. */
export function streakAnnouncement(
  displayName: string,
  length: number,
  matchId: string,
  accountId: number
): Announcement | null {
  if (length < 5 || length % 5 !== 0) return null

  return {
    key: `streak:${accountId}:${length}:${matchId}`,
    kind: 'streak',
    text: `**${displayName}** has won ${length} in a row.`,
  }
}
