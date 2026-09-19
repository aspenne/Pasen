/**
 * Motion tokens for the whole site. Kept in one place so the pace stays
 * consistent, and so dialling the site down to "calm" is a one-file edit.
 *
 * This is a stats site people reload many times a day. Anything that replays on
 * every navigation has to be short enough to go unnoticed by the third visit.
 */
export const MOTION = {
  /** Headline figures counting to their value. */
  count: 550,
  /** A list item fading and rising into place. */
  reveal: 380,
  /** Gap between consecutive items in a staggered list. */
  step: 22,
  /** How far a revealing item travels, in pixels. */
  rise: 10,
} as const

/**
 * Honours the OS "reduce motion" setting. Read at call time rather than cached:
 * the setting can change while the tab is open.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
