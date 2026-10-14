import { Link } from '@tanstack/react-router'
import type { QueueScope } from '@pasen/shared'

import type { LesBoard } from '@/lib/api'
import { signed } from '@/lib/ladder'
import { countdownLabel } from '@/lib/les'

/** Until the LAN: a daily reminder that the climb is on, and who leads it. */
export function LesBanner({ board, group, scope }: { board: LesBoard | undefined; group: string; scope: QueueScope }) {
  if (!board || board.event.finished) return null
  const leader = board.entries.find((entry) => entry.games > 0)
  return (
    <Link
      to="/$group/les"
      params={{ group }}
      search={{ scope }}
      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-l-2 border-accent bg-panel px-4 py-3 transition-colors hover:bg-panel-raised"
    >
      <span className="display text-[15px] font-semibold uppercase tracking-[0.06em] text-ink">
        Road to LES · {countdownLabel(board.event.endsAt)}
      </span>
      <span className="tnum text-[12px] text-ink-muted">
        {leader ? `leading: ${leader.displayName} ${signed(leader.lpGained)} LP` : 'nobody has played yet'} →
      </span>
    </Link>
  )
}
