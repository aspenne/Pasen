import { Link, createFileRoute, useParams, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { CustomDashboard } from '@/components/customs/CustomDashboard'
import { CustomLeaderboard } from '@/components/customs/CustomLeaderboard'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { useStaticData } from '@/lib/ddragon'
import { customResult, customTitle } from '@/lib/customs'
import { duration } from '@/lib/format'

export const Route = createFileRoute('/$group/customs/')({ component: CustomsPage })

function CustomsPage() {
  const { group } = useParams({ from: '/$group/customs/' })
  const { scope } = useSearch({ from: '/$group' })

  const { data: overview } = useQuery({
    queryKey: ['group', group, scope],
    queryFn: () => api.group(group, { scope }),
  })
  const { data, isPending } = useQuery({
    queryKey: ['customs', group],
    queryFn: () => api.customGames(group),
  })

  /*
   * Under the list's key, so deciding a winner on a game's page - which
   * invalidates ['customs', group] - refreshes the table too.
   */
  const { data: standings } = useQuery({
    queryKey: ['customs', group, 'standings'],
    queryFn: () => api.customStandings(group),
  })

  const { data: dashboard } = useQuery({
    queryKey: ['customs', group, 'dashboard'],
    queryFn: () => api.customDashboard(group),
  })
  const { data: staticData } = useStaticData()

  const timezone = overview?.timezone ?? 'Europe/Paris'

  return (
    <div className="space-y-5">
      <header>
        <h1 className="display text-[30px] font-bold uppercase tracking-[0.03em] text-ink">
          Customs
        </h1>
        <p className="mt-1 max-w-[62ch] text-[13px] text-ink-muted">
          Games Riot keeps no record of. Each one exists only because someone ran the agent beside
          it and uploaded what it caught.
        </p>
      </header>

      {standings && <CustomLeaderboard data={standings} groupSlug={group} />}

      {dashboard && (
        <CustomDashboard data={dashboard} staticData={staticData} groupSlug={group} scope={scope} />
      )}

      <h2 className="text-[11px] uppercase tracking-[0.15em] text-ink-dim">Every custom</h2>

      {isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-[68px]" />
          <Skeleton className="h-[68px]" />
        </div>
      ) : !data || data.games.length === 0 ? (
        <p className="border-l-2 border-line-strong bg-panel px-4 py-3 text-[13px] text-ink-muted">
          No custom captured yet. Run the agent during a custom, then upload the file from the admin.
        </p>
      ) : (
        <ul className="space-y-2">
          {data.games.map((game) => {
            const result = customResult(game)
            const humans = game.teams.flatMap((team) => team.players).filter((p) => !p.isBot)

            return (
              <li key={game.id}>
                <Link
                  to="/$group/customs/$id"
                  params={{ group, id: String(game.id) }}
                  search={{ scope }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-panel px-4 py-3 transition-colors hover:bg-panel-raised"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="display truncate text-[17px] font-semibold text-ink">
                        {customTitle(game)}
                      </span>
                      {game.againstBots && (
                        <span className="shrink-0 rounded-[3px] border border-line-strong px-1 text-[10px] uppercase tracking-[0.1em] text-ink-dim">
                          vs bots
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[12px] text-ink-dim">
                      {new Date(game.playedAt).toLocaleString('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: timezone,
                      })}
                      {' · '}
                      {duration(game.duration)}
                      {humans.length > 0 && ` · ${humans.map((p) => p.displayName ?? p.name).join(', ')}`}
                    </div>
                  </div>

                  <span className={`display text-[13px] font-semibold uppercase tracking-[0.08em] ${result.tone}`}>
                    {result.text}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
