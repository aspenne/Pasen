import { Link } from '@tanstack/react-router'
import type { QueueScope } from '@pasen/shared'

import type { FearlessBoard } from '@/lib/api'

/** Only while a night runs: the way to the list from wherever people land. */
export function FearlessBanner({
  board,
  group,
  scope,
}: {
  board: FearlessBoard | null | undefined
  group: string
  scope: QueueScope
}) {
  if (!board?.night.active) return null
  return (
    <Link
      to="/$group/fearless"
      params={{ group }}
      search={{ scope }}
      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-l-2 border-accent bg-panel px-4 py-3 transition-colors hover:bg-panel-raised"
    >
      <span className="display text-[15px] font-semibold uppercase tracking-[0.06em] text-ink">
        {board.night.label ?? 'Fearless night'} in progress
      </span>
      <span className="tnum text-[12px] text-ink-muted">
        {board.burned.length} burned · see what is free →
      </span>
    </Link>
  )
}
