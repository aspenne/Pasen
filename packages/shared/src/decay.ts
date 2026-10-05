import { TIER_ORDER, type Tier } from './ranks.js'

/**
 * Ranked decay, which Riot does not expose and we therefore have to derive.
 *
 * `league-v4` carries no countdown. The only decay signal in the payload is
 * `inactive`, a boolean that says a standing is already decaying but not how
 * long anyone else has left. Everything below reconstructs the counter from the
 * one thing we do hold: every ranked game, with its timestamp.
 *
 * The mechanic is a bank of days. Playing a ranked game credits it, a day
 * passing debits one, and the bank is capped. At zero the standing loses LP
 * every day until it is played again.
 */
export type DecayRule = {
  /** Days the bank holds at most, and what a fresh standing starts with. */
  cap: number
  /** Days credited by one ranked game in that queue. */
  perGame: number
  /** LP taken each day once the bank is empty. */
  lpPerDay: number
}

const DIAMOND: DecayRule = { cap: 28, perGame: 7, lpPerDay: 50 }
/**
 * Apex banks one day per game against a fourteen-day cap, so filling it takes
 * fourteen games where Diamond needs four. That asymmetry is the whole reason
 * Master players decay and Diamond players mostly do not.
 */
const APEX: DecayRule = { cap: 14, perGame: 1, lpPerDay: 75 }

/** Null for every tier that does not decay at all - Emerald and below. */
export function decayRuleFor(tier: string | null | undefined): DecayRule | null {
  if (!tier) return null
  const name = tier.toUpperCase() as Tier
  if (TIER_ORDER.indexOf(name) < TIER_ORDER.indexOf('DIAMOND')) return null
  return name === 'DIAMOND' ? DIAMOND : APEX
}

/** Games played on one calendar day, oldest first, in the queue being measured. */
export type DecayDay = { day: string; games: number }

export type DecayState = {
  /** Days left before LP starts falling. Zero means it is falling now. */
  daysLeft: number
  cap: number
  lpPerDay: number
  /**
   * False when the history is too short for the answer to mean anything - the
   * starting bank is an assumption, and it only washes out once the player has
   * refilled the cap at least once inside the window we hold.
   */
  confident: boolean
}

/**
 * Walks the bank day by day from the first day of history to `today`.
 *
 * The starting bank is assumed full, because it is the only assumption that is
 * safe in the direction that matters: it can overstate how long someone has
 * left early on, never understate it, and the cap erases it the moment they
 * play enough to refill. `confident` reports whether that has happened.
 *
 * Deliberately a simulation rather than a formula. The bank clamps at both
 * ends - it cannot exceed the cap, and it cannot go below zero while someone
 * keeps decaying - and those two clamps are what make a closed form wrong.
 */
export function simulateBank(days: DecayDay[], rule: DecayRule, today: string): DecayState {
  const base = { cap: rule.cap, lpPerDay: rule.lpPerDay }
  if (days.length === 0) return { daysLeft: 0, confident: false, ...base }

  let bank = rule.cap
  let dipped = false
  let refilled = false
  const counts = new Map(days.map((entry) => [entry.day, entry.games]))

  let cursor = days[0].day
  while (cursor <= today) {
    const games = counts.get(cursor) ?? 0
    bank = Math.min(rule.cap, bank + rule.perGame * games)

    /*
     * A refill only counts once the bank has been below the cap: the walk
     * starts at the cap, so without `dipped` the very first game played would
     * look like proof and the assumption would vouch for itself.
     */
    if (games > 0 && bank === rule.cap && dipped) refilled = true

    /*
     * Today has not ticked yet - the bank is being reported as it stands this
     * morning, not as it will stand tonight. Debiting it here would take a day
     * off the moment someone finished a game.
     */
    if (cursor !== today) {
      bank = Math.max(0, bank - 1)
      if (bank < rule.cap) dipped = true
    }

    cursor = nextDay(cursor)
  }

  return { daysLeft: bank, confident: refilled, ...base }
}

/** Dates as plain YYYY-MM-DD, so a day is a day regardless of anyone's clock. */
function nextDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, date + 1))
  return next.toISOString().slice(0, 10)
}
