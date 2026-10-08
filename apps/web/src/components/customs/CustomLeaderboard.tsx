import { Link } from '@tanstack/react-router'

import type { CustomStandings } from '@/lib/api'
import type { QueueScope } from '@pasen/shared'

/**
 * Who has won the most customs.
 *
 * Inhouses only: a game where everyone but one person is a bot is practice,
 * not a win over anyone, so it never reaches the table - and the line under it
 * says how many were left out, so an empty table is never a mystery.
 */
export function CustomLeaderboard({
  data,
  groupSlug,
  scope,
}: {
  data: CustomStandings
  groupSlug: string
  scope: QueueScope
}) {
  const { standings, skipped } = data
  const left = [
    skipped.againstBots > 0 &&
      `${skipped.againstBots} game${skipped.againstBots === 1 ? '' : 's'} against bots`,
    skipped.unknownResult > 0 &&
      `${skipped.unknownResult} without a result`,
  ].filter(Boolean)

  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[11px] uppercase tracking-[0.15em] text-ink-dim">Most wins</h2>
        {left.length > 0 && (
          <span className="text-[11px] text-ink-dim">Not counted: {left.join(', ')}</span>
        )}
      </div>

      {standings.length === 0 ? (
        <p className="bg-panel px-4 py-3 text-[13px] text-ink-muted">
          No inhouse counted yet. The table fills from the first custom with at least two of you in
          it.
        </p>
      ) : (
        <ol className="divide-y divide-line bg-panel">
          {standings.map((row, index) => (
            <li key={row.key} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className={`display tnum w-6 shrink-0 text-[17px] font-bold ${
                  index === 0 ? 'text-accent' : 'text-ink-dim'
                }`}
              >
                {index + 1}
              </span>

              <span className="min-w-0 flex-1">
                {row.memberSlug ? (
                  <Link
                    to="/$group/players/$member"
                    params={{ group: groupSlug, member: row.memberSlug }}
                    search={{ scope }}
                    className="display block truncate text-[16px] font-semibold text-ink transition-colors hover:text-accent"
                  >
                    {row.name}
                  </Link>
                ) : (
                  <span className="display block truncate text-[16px] font-semibold text-ink-muted">
                    {row.name}
                  </span>
                )}
              </span>

              <span className="tnum shrink-0 text-right">
                <span className="display block text-[17px] font-bold text-ink">
                  {row.wins}
                  <span className="ml-1 font-sans text-[11px] font-normal text-ink-dim">
                    {row.wins === 1 ? 'win' : 'wins'}
                  </span>
                </span>
                <span className="block text-[11px] text-ink-dim">
                  {row.wins}–{row.losses} ·{' '}
                  <span className={row.winRate >= 50 ? 'text-win' : 'text-loss'}>
                    {row.winRate}%
                  </span>
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
