import { Link, Outlet, createFileRoute, useNavigate, useParams, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { DEFAULT_SCOPE, QUEUE_SCOPES, type QueueScope } from '@pasen/shared'

import { LiveRail } from '@/components/layout/LiveRail'
import { RosterRail } from '@/components/layout/RosterRail'
import { WeekBoards } from '@/components/layout/WeekBoards'
import { PlayerSwitcher } from '@/components/nav/PlayerSwitcher'
import { ScopeSelect } from '@/components/ScopeSelect'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { useStaticData } from '@/lib/ddragon'
import { groupNav } from '@/lib/nav'

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

const RAIL =
  'flex min-w-0 flex-col gap-4 self-start min-[1280px]:sticky min-[1280px]:top-[68px] min-[1280px]:max-h-[calc(100vh-84px)] min-[1280px]:overflow-y-auto'

/** The members in a game right now. */
function playing(games: { participants: { memberSlug: string | null }[] }[]): Set<string> {
  return new Set(
    games.flatMap((game) => game.participants.map((participant) => participant.memberSlug)).filter(
      (slug): slug is string => slug !== null
    )
  )
}

function GroupLayout() {
  const { group } = useParams({ from: '/$group' })
  const { scope } = Route.useSearch()
  /*
   * Unbound, because this header renders over the group's child routes too.
   * Pinning `from` to '/$group' made every scope change resolve back to the
   * group index, dropping whoever's page you were reading.
   */
  const navigate = useNavigate()

  const { data, error, isPending } = useQuery({
    queryKey: ['group', group, scope],
    queryFn: () => api.group(group, { scope }),
  })

  // Shares the admin page's key: signed in there, the menu leads back to it.
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: api.session })

  const { data: status } = useQuery({
    queryKey: ['status'],
    queryFn: () => api.status(),
    refetchInterval: 5 * 60_000,
  })

  // The drafter is a full-screen board, like a champion select: no menu, no column.
  const { data: live } = useQuery({
    queryKey: ['live', group],
    queryFn: () => api.live(group),
    refetchInterval: 20_000,
  })

  const { data: week } = useQuery({
    queryKey: ['leaderboards', group, 'week', scope],
    queryFn: () => api.leaderboards(group, { period: 'week', scope }),
    refetchInterval: 5 * 60_000,
  })

  const { data: staticData } = useStaticData()

  const pathname = useRouterState({ select: (state) => state.location.pathname })
  if (pathname.endsWith('/draft')) {
    return (
      <div className="min-h-screen bg-ground text-ink">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ground text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-ground/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1640px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex items-baseline gap-3">
            <Link
              to="/"
              className="tap inline-flex items-center text-[13px] tracking-[0.14em] text-accent"
            >
              PASEN
            </Link>
            {isPending ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              <span className="text-[13px] text-ink">{data?.name ?? group}</span>
            )}
          </div>

          {/*
            Wraps as well as the header around it. Held on one line, the three
            controls together needed 326px and pushed the whole document into a
            sideways scroll at 320 - the width WCAG asks a page to reflow at.
          */}
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            <nav className="flex gap-4 text-[12px]">
              {groupNav(Boolean(session?.authenticated)).map((entry) =>
                entry.to === '/admin' ? (
                  <Link
                    key={entry.label}
                    to="/admin"
                    className="tap inline-flex items-center justify-center text-accent hover:text-ink"
                  >
                    {entry.label}
                  </Link>
                ) : (
                  <Link
                    key={entry.label}
                    to={entry.to}
                    params={{ group }}
                    search={{ scope }}
                    activeOptions={{ exact: entry.exact }}
                    className="tap inline-flex items-center justify-center"
                    activeProps={{ className: 'text-ink' }}
                    inactiveProps={{ className: 'text-ink-muted hover:text-ink' }}
                  >
                    {entry.label}
                  </Link>
                )
              )}
            </nav>

            <ScopeSelect
              value={scope}
              onChange={(next) =>
                navigate({
                  // '.' is wherever the reader already is; only the scope moves.
                  to: '.',
                  search: (prev) => ({ ...prev, scope: next }),
                  // replace, not push: flipping a filter is not a place to go back to.
                  replace: true,
                })
              }
            />

            {data && <PlayerSwitcher group={group} members={data.members} scope={scope} />}
          </div>
        </div>
      </header>

      {status?.ingestion.paused && (
        /*
         * The site's worst failure is the quiet one: pages keep working while
         * nothing new arrives, and nobody can tell "nobody played" from "we
         * stopped being able to look".
         */
        <p className="mx-auto flex max-w-[1640px] flex-wrap items-baseline gap-x-2 border-l-2 border-accent bg-accent-soft/40 px-4 py-2.5 text-[13px] text-ink">
          <span>Riot stopped accepting our key</span>
          {status.ingestion.since && (
            <span className="text-ink-muted">
              on{' '}
              {new Date(status.ingestion.since).toLocaleString('en-GB', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
          <span className="text-ink-muted">
            · nothing new has come in since, so everything below is what we already held.
          </span>
        </p>
      )}

      {/*
        Three columns on a wide screen: the roster on the left, what is
        happening on the right, the page in between. Narrower, the roster drops
        under the page; on a phone both rails follow the page, live games first.
      */}
      <div className="mx-auto grid max-w-[1640px] grid-cols-[minmax(0,1fr)] gap-4 px-4 py-5 min-[900px]:grid-cols-[minmax(0,1fr)_300px] min-[1280px]:grid-cols-[270px_minmax(0,1fr)_310px]">
        <main className="@container min-w-0 min-[1280px]:order-2">
          {error ? (
            <p className="border-l-2 border-loss bg-panel px-4 py-3 text-[13px] text-ink-muted">
              No group called “{group}”.
            </p>
          ) : (
            <Outlet />
          )}
        </main>

        {!error && (
          <>
            <aside className={`${RAIL} order-3 min-[900px]:col-span-full min-[1280px]:order-1 min-[1280px]:col-span-1`}>
              {data && (
                <RosterRail
                  members={data.members}
                  group={group}
                  scope={scope}
                  playing={playing(live?.games ?? [])}
                />
              )}
            </aside>

            <aside className={`${RAIL} order-2 min-[1280px]:order-3`}>
              <LiveRail games={live?.games ?? []} staticData={staticData} />
              {week && <WeekBoards boards={week} group={group} scope={scope} />}
            </aside>
          </>
        )}
      </div>
    </div>
  )
}
