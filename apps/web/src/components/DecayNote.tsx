import type { DecayStatus } from '@/lib/api'

type DecayNoteProps = {
  decay: DecayStatus | null
  /**
   * Shows nothing until the countdown is actually news. A roster of twenty-six
   * lines each saying "decays in 27 days" is noise; the same line at two days
   * is the only reason the feature exists.
   */
  urgentOnly?: boolean
}

/** Below this, it is worth interrupting someone's reading. Above, it is not. */
export const DECAY_URGENT_DAYS = 3

/**
 * How long a Diamond-or-above standing has before it starts losing LP.
 *
 * Riot publishes no such counter, so this is reconstructed from the ranked
 * games we hold. The `≈` is not decoration: it marks the case where our window
 * of history is too short to have erased the assumption it starts from, and it
 * disappears the moment the player's own games account for the whole number.
 */
export function DecayNote({ decay, urgentOnly = false }: DecayNoteProps) {
  if (!decay) return null

  const decaying = decay.inactive || decay.daysLeft === 0
  const urgent = decaying || decay.daysLeft <= DECAY_URGENT_DAYS
  if (urgentOnly && !urgent) return null

  const label = decaying
    ? `Decaying · −${decay.lpPerDay} LP a day`
    : `${decay.confident ? '' : '≈'}Decays in ${decay.daysLeft} day${decay.daysLeft === 1 ? '' : 's'}`

  const title = decaying
    ? decay.inactive
      ? `Riot has this account flagged as inactive: it is losing ${decay.lpPerDay} LP a day until a ranked game is played.`
      : `The banked days are spent, so this standing loses ${decay.lpPerDay} LP a day until a ranked game is played.`
    : `${decay.daysLeft} of ${decay.cap} banked days left. Riot publishes no countdown, so this is worked out from the ranked games we have stored${decay.confident ? '' : ', and the history is still short enough that it may be generous'}.`

  return (
    <span
      title={title}
      className={`tnum text-[11px] ${urgent ? 'text-loss' : 'text-ink-dim'}`}
    >
      {label}
    </span>
  )
}
