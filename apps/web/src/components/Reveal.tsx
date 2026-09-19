import { animate, stagger, utils } from 'animejs'
import { useLayoutEffect, useRef, type ReactNode } from 'react'

import { MOTION, prefersReducedMotion } from '@/lib/motion'

type RevealProps = {
  /**
   * Re-runs the reveal when this changes. Pass what defines the list's
   * identity — the queue scope, the date — never its length, or appending a
   * page of history would replay the whole list.
   */
  token: string | number
  className?: string
  children: ReactNode
}

/**
 * Fades and lifts its direct children into place, one shortly after the next.
 * Renders as a plain div, so it can carry the list's own grid or spacing
 * classes instead of adding a wrapper that would break them.
 */
export function Reveal({ token, className, children }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Layout effect, not effect: the items are hidden before the browser paints,
  // so there is no flash of the finished list first.
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return

    const items = Array.from(root.children) as HTMLElement[]
    if (items.length === 0 || prefersReducedMotion()) return

    utils.set(items, { opacity: 0, translateY: MOTION.rise })
    const animation = animate(items, {
      opacity: 1,
      translateY: 0,
      duration: MOTION.reveal,
      delay: stagger(MOTION.step),
      ease: 'outQuart',
    })

    // Nothing may be left mid-fade if this unmounts or the token changes.
    return () => {
      animation.pause()
      utils.set(items, { opacity: 1, translateY: 0 })
    }
  }, [token])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
