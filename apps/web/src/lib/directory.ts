import type { GroupCard } from '@/lib/api'

export type GroupSignal = { kind: 'live' | 'today' | 'fearless' | 'quiet'; text: string }

/**
 * What a group card says about right now, most urgent first: someone in a
 * game beats the day's count, which beats a fearless night. A group with
 * none of it says so rather than showing an empty strip.
 */
export function groupSignals(card: GroupCard): GroupSignal[] {
  const signals: GroupSignal[] = []
  if (card.inGame > 0) signals.push({ kind: 'live', text: `${card.inGame} in game now` })
  if (card.gamesToday > 0) {
    signals.push({ kind: 'today', text: `${card.gamesToday} game${card.gamesToday === 1 ? '' : 's'} today` })
  }
  if (card.fearless) {
    signals.push({
      kind: 'fearless',
      text: `${card.fearless.label ?? 'Fearless night'} · ${card.fearless.burned} burned`,
    })
  }
  return signals.length > 0 ? signals : [{ kind: 'quiet', text: 'No game yet today' }]
}
