import { animate } from 'animejs'
import { useEffect, useRef, useState } from 'react'

import { MOTION, prefersReducedMotion } from '@/lib/motion'

type CountUpProps = {
  value: number
  /** Decimal places to hold throughout the count, so the width never jitters. */
  decimals?: number
  /** Rendered straight after the number: '%', ' LP'. */
  suffix?: string
}

/**
 * Counts from the previous value to the new one. On first paint the previous
 * value is zero, so a figure arriving from the API counts up; afterwards a
 * scope change counts across from what was on screen, which reads as the same
 * number moving rather than a different number appearing.
 */
export function CountUp({ value, decimals = 0, suffix = '' }: CountUpProps) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0))
  const from = useRef(shown)

  useEffect(() => {
    if (prefersReducedMotion()) {
      from.current = value
      setShown(value)
      return
    }

    const state = { n: from.current }
    const settle = () => {
      from.current = value
      setShown(value)
    }

    const animation = animate(state, {
      n: value,
      duration: MOTION.count,
      ease: 'outQuart',
      onUpdate: () => setShown(state.n),
      onComplete: settle,
    })

    /*
     * A backgrounded or power-saving tab stops handing out animation frames,
     * and a figure frozen halfway to its value is not a slower animation - it
     * is a wrong number sitting on screen. Timers survive that throttling far
     * better than frames do, so one commits the truth regardless.
     */
    const safety = window.setTimeout(() => {
      animation.pause()
      settle()
    }, MOTION.count * 3)

    // Leaving mid-count would strand the figure between two values.
    return () => {
      window.clearTimeout(safety)
      animation.pause()
      from.current = value
    }
  }, [value])

  return (
    <span className="tnum">
      {shown.toFixed(decimals)}
      {suffix}
    </span>
  )
}
