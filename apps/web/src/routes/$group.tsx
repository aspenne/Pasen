import { Link, Outlet, createFileRoute, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

export const Route = createFileRoute('/$group')({ component: GroupLayout })

function GroupLayout() {
  const { group } = useParams({ from: '/$group' })
  const { data, error } = useQuery({
    queryKey: ['group', group],
    queryFn: () => api.group(group),
  })

  return (
    <div className="min-h-screen bg-ground text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-baseline gap-3">
            <Link to="/" className="text-[13px] tracking-[0.14em] text-gold">
              PASEN
            </Link>
            <span className="text-[13px] text-ink">{data?.name ?? group}</span>
          </div>

          <nav className="flex gap-4 text-[12px]">
            <Link
              to="/$group"
              params={{ group }}
              activeOptions={{ exact: true }}
              activeProps={{ className: 'text-ink' }}
              inactiveProps={{ className: 'text-ink-muted hover:text-ink' }}
            >
              Today
            </Link>
            <Link
              to="/$group/insights"
              params={{ group }}
              activeProps={{ className: 'text-ink' }}
              inactiveProps={{ className: 'text-ink-muted hover:text-ink' }}
            >
              Insights
            </Link>
            {data?.members.map((member) => (
              <Link
                key={member.slug}
                to="/$group/players/$member"
                params={{ group, member: member.slug }}
                activeProps={{ className: 'text-ink' }}
                inactiveProps={{ className: 'text-ink-muted hover:text-ink' }}
              >
                {member.displayName}
              </Link>
            ))}
          </nav>
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
