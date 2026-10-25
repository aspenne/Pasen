import { Link } from '@tanstack/react-router'
import type { QueueScope } from '@pasen/shared'

import type { Leaderboards } from '@/lib/api'
import { boardLeaders } from '@/lib/rails'

/** The four boards worth a glance; the rest live on Insights. */
const SHOWN = ['winRate', 'games', 'kda', 'csPerMinute']

/** This week's top three on the boards people argue about. */
export function WeekBoards({
  boards,
  group,
  scope,
}: {
  boards: Leaderboards
  group: string
  scope: QueueScope
}) {
  const shown = SHOWN.map((key) => boards.boards.find((board) => board.key === key))
    .filter((board) => board !== undefined)
    .map((board) => ({ board, leaders: boardLeaders(board, boards.totals, boards.minimumGames) }))
    .filter(({ leaders }) => leaders.length > 0)

  return (
    <section aria-labelledby="week-boards">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="week-boards" className="text-[11px] uppercase tracking-[0.15em] text-ink-dim">
          This week
        </h2>
        <Link
          to="/$group/insights"
          params={{ group }}
          search={{ scope }}
          className="tap inline-flex items-center text-[11px] text-ink-dim transition-colors hover:text-ink"
        >
          All boards
        </Link>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-[8px] border border-line bg-panel px-3 py-2.5 text-[12px] text-ink-muted">
          Nobody has played this week yet.
        </p>
      ) : (
        <div className="space-y-2">
          {shown.map(({ board, leaders }) => (
            <div key={board.key} className="rounded-[8px] border border-line bg-panel px-3 py-2.5">
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <h3 className="text-[11px] text-ink-muted">{board.label}</h3>
                {board.unit === '%' && (
                  <span className="text-[10px] text-ink-dim">{boards.minimumGames}+ games</span>
                )}
              </div>
              <ol className="space-y-1">
                {leaders.map((entry, place) => (
                  <li key={entry.memberSlug} className="flex items-baseline gap-2 text-[12.5px]">
                    <span className={`tnum w-3 shrink-0 text-[11px] ${place === 0 ? 'text-accent' : 'text-ink-dim'}`}>
                      {place + 1}
                    </span>
                    <Link
                      to="/$group/players/$member"
                      params={{ group, member: entry.memberSlug }}
                      search={{ scope }}
                      className="min-w-0 flex-1 truncate text-ink hover:text-accent"
                    >
                      {entry.displayName}
                    </Link>
                    <span className={`tnum shrink-0 ${place === 0 ? 'text-ink' : 'text-ink-muted'}`}>
                      {entry.value}
                      {board.unit === '%' ? '%' : ''}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
