import type { RouletteSide, RouletteView } from '@/lib/api'

export const ROLES = [
  { key: 'TOP', label: 'Top', icon: 'top' },
  { key: 'JUNGLE', label: 'Jungle', icon: 'jungle' },
  { key: 'MIDDLE', label: 'Mid', icon: 'middle' },
  { key: 'BOTTOM', label: 'Bot', icon: 'bottom' },
  { key: 'UTILITY', label: 'Support', icon: 'utility' },
] as const

/** One card turns every this many milliseconds once the reveal starts. */
export const REVEAL_STEP_MS = 650

/** Riot's own lane icons, the ones the client shows in its position picker. */
export function roleIcon(icon: (typeof ROLES)[number]['icon']): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-${icon}.png`
}

/** Blue top, red top, blue jungle, red jungle… - a lane at a time, so both sides keep pace. */
export function revealOrder(): [RouletteSide, number][] {
  return ROLES.flatMap((_, lane) => [
    ['blue', lane],
    ['red', lane],
  ] as [RouletteSide, number][])
}

/**
 * How many cards are face up now. Worked out from the server's reveal time
 * and the gap between the server's clock and this one, so every page shows
 * the same card turning at the same moment - and a late arrival simply sees
 * where the reveal has got to.
 */
export function revealedCount(revealAt: string, serverOffsetMs: number, now: number = Date.now()): number {
  const elapsed = now + serverOffsetMs - Date.parse(revealAt)
  if (elapsed < 0) return 0
  return Math.min(revealOrder().length, Math.floor(elapsed / REVEAL_STEP_MS) + 1)
}

/** The draw as a message for the group chat, lane by lane. */
export function discordText(view: RouletteView): string {
  if (!view.lobby || !view.draw) return ''
  const { teams } = view.lobby
  const { roles } = view.draw
  return (['blue', 'red'] as const)
    .map((side) => {
      const lanes = ROLES.flatMap((role, lane) => {
        const seat = roles[side][lane]
        return seat === null || seat === undefined ? [] : [`${role.label}: ${teams[side][seat].name}`]
      })
      return `${side === 'blue' ? 'Blue' : 'Red'} — ${lanes.join(' · ')}`
    })
    .join('\n')
}
