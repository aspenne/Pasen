import { Link, Outlet, createFileRoute, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { PlayerSwitcher } from '@/components/nav/PlayerSwitcher'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'

export const Route = createFileRoute('/$group')({ component: GroupLayout })

const NAV = [
  { to: '/$group', label: 'Today', exact: true },
  { to: '/$group/insights', label: 'Insights', exact: false },
] as const

function GroupLayout() {
  const { group } = useParams({ from: '/$group' })
  const { data, error, isPending } = useQuery({
    queryKey: ['group', group],
    queryFn: () => api.group(group),
  })

  return (
    <div className="min-h-screen bg-ground text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-ground/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
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
                  activeOptions={{ exact: entry.exact }}
                  activeProps={{ className: 'text-ink' }}
                  inactiveProps={{ className: 'text-ink-muted hover:text-ink' }}
                >
                  {entry.label}
                </Link>
              ))}
            </nav>

            {data && <PlayerSwitcher group={group} members={data.members} />}
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
