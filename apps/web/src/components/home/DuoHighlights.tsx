import { Link } from '@tanstack/react-router'

import type { DuoPair } from '@/lib/api'
import type { QueueScope } from '@pasen/shared'

type DuoHighlightsProps = {
  pairs: DuoPair[]
  nameOf: (slug: string) => string
  colorFor: (slug: string) => string
  groupSlug: string
  scope: QueueScope
  limit?: number
}

/**
 * The pairs that play together most, and how that compares with the two of them
 * apart.
 *
 * The two ticks on the bar are each player's win rate without the other, so the
 * fill landing past both says the pair is doing better than either manages
 * alone. Worth stating plainly: people duo when both are around and willing,
 * which is not a random sample, so this describes the pairing rather than
 * proving anything about it.
 */
export function DuoHighlights({
  pairs,
  nameOf,
  colorFor,
  groupSlug,
  scope,
  limit = 3,
}: DuoHighlightsProps) {
  const top = pairs.slice(0, limit)
  if (top.length === 0) return null

  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] uppercase tracking-[0.15em] text-ink-dim">Better together?</h2>
        <Link
          to="/$group/insights"
          params={{ group: groupSlug }}
          search={{ scope }}
          className="tap inline-flex items-center justify-end text-[11px] text-ink-dim transition-colors hover:text-ink"
        >
          Every pair
        </Link>
      </div>

      <div className="space-y-2">
        {top.map((pair) => (
          <div
            key={`${pair.a}-${pair.b}`}
            className="tinted flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[8px] border border-line bg-panel px-3.5 py-3"
          >
            <span className="flex shrink-0 gap-1" aria-hidden>
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: colorFor(pair.a) }}
              />
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: colorFor(pair.b) }}
              />
            </span>

            <span className="min-w-0 basis-[200px]">
              <span className="block truncate text-[13px] text-ink">
                {nameOf(pair.a)} + {nameOf(pair.b)}
              </span>
              <span className="tnum block text-[11px] text-ink-dim">
                {pair.games} games together
              </span>
            </span>

            <span
              className="relative h-1.5 min-w-[90px] flex-1 rounded-[3px] bg-line-strong"
              role="img"
              aria-label={`Together ${pair.winRate}%, apart ${pair.soloWinRateA}% and ${pair.soloWinRateB}%`}
            >
              <span
                className="absolute inset-y-0 left-0 rounded-[3px] bg-win"
                style={{ width: `${Math.min(pair.winRate, 100)}%` }}
              />
              {[pair.soloWinRateA, pair.soloWinRateB].map((solo, index) => (
                <span
                  key={index}
                  className="absolute -top-1 -bottom-1 w-px bg-ink-muted"
                  style={{ left: `${Math.min(solo, 100)}%` }}
                />
              ))}
            </span>

            <span className="shrink-0 text-right">
              <span className="tnum block text-[15px] text-win">{pair.winRate}%</span>
              <span className="tnum block text-[11px] text-ink-dim">
                apart {pair.soloWinRateA}% / {pair.soloWinRateB}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
