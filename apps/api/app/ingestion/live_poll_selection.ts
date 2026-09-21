import type { DateTime } from 'luxon'

/** How recently someone must have played to be polled on every cycle. */
export const HOT_WINDOW_HOURS = 6

/**
 * Cold accounts are split across this many cycles, so each is still reached
 * every five minutes. A game runs twenty minutes at the shortest, so a player
 * who wakes up is caught well inside their first one - and once caught they are
 * hot, which is what matters: the end of a game has to be noticed promptly,
 * since that is what puts the match in the feed.
 */
export const COLD_CYCLES = 5

export type PollCandidate = {
  id: number
  lastSeenLiveAt: DateTime | null
}

/**
 * Chooses which accounts to ask spectator about this minute.
 *
 * Riot gives a development or personal key a hundred requests every two
 * minutes. Polling twenty-five accounts once a minute spends fifty of them on
 * the single question "is anyone playing", leaving half the budget for
 * everything the site actually shows. Most of those answers are no: of our
 * twenty-five, six were in a game and nine had played at all in six hours.
 *
 * So: everyone in a game or recently in one, every cycle - and the rest in
 * rotation. The rotation is derived from the clock and the account id rather
 * than stored, which keeps it even without a cursor to lose.
 */
export function selectLivePollTargets<T extends PollCandidate>(
  accounts: T[],
  lastPlayedAt: Map<number, DateTime>,
  now: DateTime
): T[] {
  const cycle = Math.floor(now.toSeconds() / 60) % COLD_CYCLES

  return accounts.filter((account) => {
    if (account.lastSeenLiveAt !== null) return true

    const played = lastPlayedAt.get(account.id)
    if (played && now.diff(played, 'hours').hours < HOT_WINDOW_HOURS) return true

    return account.id % COLD_CYCLES === cycle
  })
}
