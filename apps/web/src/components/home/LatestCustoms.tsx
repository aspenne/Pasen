import { Link } from '@tanstack/react-router'

import type { CustomGame } from '@/lib/api'
import { customResult, customTitle } from '@/lib/customs'
import { duration } from '@/lib/format'
import type { QueueScope } from '@pasen/shared'

/** Enough to show that customs exist and what the last one was. */
const SHOWN = 2

/**
 * The way in to captured customs from the home page.
 *
 * Always rendered once the list has loaded, empty or not: the point of the
 * block is the link, and a link that only appears after the first upload is a
 * page nobody learns exists.
 */
export function LatestCustoms({
  games,
  groupSlug,
  scope,
  timezone,
}: {
  games: CustomGame[]
  groupSlug: string
  scope: QueueScope
  timezone: string
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] uppercase tracking-[0.15em] text-ink-dim">Customs</h2>
        <Link
          to="/$group/customs"
          params={{ group: groupSlug }}
          search={{ scope }}
          className="tap inline-flex items-center justify-end text-[11px] text-ink-dim transition-colors hover:text-ink"
        >
          All customs
        </Link>
      </div>

      {games.length === 0 ? (
        <p className="bg-panel px-4 py-3 text-[12px] text-ink-muted">
          None captured yet. Run the agent beside a custom and upload the file from the admin.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {games.slice(0, SHOWN).map((game) => {
            const result = customResult(game)
            return (
              <li key={game.id}>
                <Link
                  to="/$group/customs/$id"
                  params={{ group: groupSlug, id: String(game.id) }}
                  search={{ scope }}
                  className="flex flex-wrap items-center gap-x-3 gap-y-0.5 bg-panel px-4 py-2.5 transition-colors hover:bg-panel-raised"
                >
                  <span className="display min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
                    {customTitle(game)}
                  </span>
                  <span className="tnum text-[11px] text-ink-dim">
                    {new Date(game.playedAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      timeZone: timezone,
                    })}
                    {' · '}
                    {duration(game.duration)}
                    {game.againstBots && ' · vs bots'}
                  </span>
                  <span
                    className={`display text-[12px] font-semibold uppercase tracking-[0.08em] ${result.tone}`}
                  >
                    {result.text}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
