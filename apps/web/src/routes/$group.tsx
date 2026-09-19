import { Link, Outlet, createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { DEFAULT_SCOPE, QUEUE_SCOPES, type QueueScope } from '@pasen/shared'

import { PlayerSwitcher } from '@/components/nav/PlayerSwitcher'
import { ScopeSelect } from '@/components/ScopeSelect'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'

/**
 * The scope lives in the URL rather than in component state, so it survives
 * navigation between pages, comes back on a reload, and travels when someone
 * pastes a link into the group chat.
 */
export const Route = createFileRoute('/$group')({
  validateSearch: (search: Record<string, unknown>): { scope: QueueScope } => ({
    scope: QUEUE_SCOPES.includes(search.scope as QueueScope)
      ? (search.scope as QueueScope)
      : DEFAULT_SCOPE,
  }),
  component: GroupLayout,
})

const NAV = [
  { to: '/$group', label: 'Today', exact: true },
  { to: '/$group/insights', label: 'Insights', exact: false },
] as const

function GroupLayout() {
  const { group } = useParams({ from: '/$group' })
  const { scope } = Route.useSearch()
  const navigate = useNavigate({ from: '/$group' })

  const { data, error, isPending } = useQuery({
    queryKey: ['group', group, scope],
    queryFn: () => api.group(group, { scope }),
  })

  return (
    <div className="min-h-screen bg-ground text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-ground/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex items-baseline gap-3">
            <Link to="/" className="text-[13px] tracking-[0.14em] text-gold">
              PASEN
            </Link>
            {isPending ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              <span className="text-[13px] text-ink">{data?.name ?? group}</span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <nav className="flex gap-4 text-[12px]">
              {NAV.map((entry) => (
                <Link
                  key={entry.label}
                  to={entry.to}
                  params={{ group }}
                  search={{ scope }}
                  activeOptions={{ exact: entry.exact }}
                  activeProps={{ className: 'text-ink' }}
                  inactiveProps={{ className: 'text-ink-muted hover:text-ink' }}
                >
                  {entry.label}
                </Link>
              ))}
            </nav>

            <ScopeSelect
              value={scope}
              onChange={(next) =>
                // replace, not push: flipping a filter is not a place to go back to.
                navigate({ search: { scope: next }, replace: true })
              }
            />

            {data && <PlayerSwitcher group={group} members={data.members} scope={scope} />}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        {error ? (
          <p className="border-l-2 border-loss bg-panel px-4 py-3 text-[13px] text-ink-muted">
            No group called “{group}”.
          </p>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  )
}
