import { createFileRoute, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { ChampionIcon } from '@/components/ChampionIcon'
import { ActivityCalendar } from '@/components/charts/ActivityCalendar'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, type Leaderboards } from '@/lib/api'
import { useStaticData } from '@/lib/ddragon'
import { memberColor } from '@/lib/format'

export const Route = createFileRoute('/$group/insights')({ component: Insights })

const PERIODS = [
  { key: 'week', label: 'Last 7 days' },
  { key: 'month', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
] as const

function Insights() {
  const { group } = useParams({ from: '/$group/insights' })
  const [period, setPeriod] = useState<Leaderboards['period']>('week')

  const { data: staticData } = useStaticData()
  const { data: overview } = useQuery({
    queryKey: ['group', group],
    queryFn: () => api.group(group),
  })
  const { data: boards } = useQuery({
    queryKey: ['leaderboards', group, period],
    queryFn: () => api.leaderboards(group, { period }),
  })
  const { data: duos } = useQuery({ queryKey: ['duos', group], queryFn: () => api.duos(group) })
  const { data: pool } = useQuery({
    queryKey: ['group-champions', group],
    queryFn: () => api.groupChampions(group),
  })
  const { data: activity } = useQuery({
    queryKey: ['activity', group],
    queryFn: () => api.activity(group),
  })

  const colorFor = useMemo(() => {
    const colors = new Map(
      overview?.members.map((member, index) => [
        member.slug,
        memberColor(member.accentColor, index),
      ]) ?? []
    )
    return (slug: string) => colors.get(slug) ?? 'var(--color-line-strong)'
  }, [overview])

  const members = overview?.members.map((m) => ({ slug: m.slug, displayName: m.displayName })) ?? []
  const year = new Date().getFullYear()

  return (
    <div className="space-y-8">
      {/* Filters sit in one row above what they filter. */}
      <Tabs value={period} onValueChange={(value) => setPeriod(value as Leaderboards['period'])}>
        <TabsList className="h-auto gap-1.5 rounded-[14px] bg-panel p-1.5">
          {PERIODS.map((entry) => (
            <TabsTrigger
              key={entry.key}
              value={entry.key}
              className="rounded-[10px] px-4 py-1.5 text-[14px] text-ink-muted data-[state=active]:bg-accent data-[state=active]:text-on-accent dark:data-[state=active]:bg-accent dark:data-[state=active]:text-on-accent"
            >
              {entry.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <section>
        <h2 className="mb-2 text-[13px] text-ink">Titles</h2>
        {!boards ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[88px]" />
            ))}
          </div>
        ) : boards.titles.length === 0 ? (
          <p className="border-l-2 border-line-strong bg-panel px-4 py-3 text-[12px] text-ink-muted">
            Nobody has played {boards.minimumGames} games in this window yet.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {boards?.titles.map((title) => (
              <div
                key={title.key}
                className="rounded-[18px] px-[17px] py-[15px]"
                style={{
                  background: 'linear-gradient(120deg, #2A1C10, #171B24 70%)',
                  borderLeft: `3px solid ${colorFor(title.memberSlug)}`,
                }}
              >
                <div className="text-[11px] uppercase tracking-[0.05em] text-ink-warm/70">
                  {title.description}
                </div>
                <div className="mt-1 text-[19px] text-accent">{title.label}</div>
                <div className="mt-0.5 text-[14px] text-ink">{title.displayName}</div>
                <div className="tnum text-[13px] text-ink-muted">{title.detail}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-[13px] text-ink">Leaderboards</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {boards?.boards.map((board) => (
            <div key={board.key} className="bg-panel px-3 py-2.5">
              <div className="mb-1.5 text-[10px] uppercase tracking-[0.08em] text-ink-dim">
                {board.label}
              </div>
              <ol className="space-y-1">
                {board.entries.map((entry, index) => (
                  <li key={entry.memberSlug} className="flex items-center gap-2 text-[12px]">
                    <span className="tnum w-3 text-ink-dim">{index + 1}</span>
                    <span
                      aria-hidden
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: colorFor(entry.memberSlug) }}
                    />
                    <span className="min-w-0 flex-1 truncate text-ink-muted">
                      {entry.displayName}
                    </span>
                    <span className="tnum text-ink">
                      {entry.value}
                      {board.unit}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-[13px] text-ink">Duo synergy</h2>
        <p className="mb-2 text-[11px] text-ink-muted">
          Win rate for each pair, and how far that sits from what the two of them
          average apart. Three games together minimum.
        </p>

        {duos && duos.pairs.length > 0 ? (
          <div className="space-y-px">
            {duos.pairs.map((pair) => {
              const apart = (pair.soloWinRateA + pair.soloWinRateB) / 2
              const lift = Math.round((pair.winRate - apart) * 10) / 10
              const nameOf = (slug: string) =>
                members.find((m) => m.slug === slug)?.displayName ?? slug

              return (
                <div
                  key={`${pair.a}-${pair.b}`}
                  className="flex items-center gap-3 bg-panel px-3 py-2 text-[12px]"
                >
                  <span className="flex shrink-0 gap-1">
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ backgroundColor: colorFor(pair.a) }}
                    />
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ backgroundColor: colorFor(pair.b) }}
                    />
                  </span>

                  <span className="w-48 shrink-0 truncate text-ink">
                    {nameOf(pair.a)} + {nameOf(pair.b)}
                  </span>

                  <span className="tnum w-14 shrink-0 text-right text-ink-dim">
                    {pair.games}g
                  </span>
                  <span className="tnum w-14 shrink-0 text-right text-ink">{pair.winRate}%</span>

                  {/* The bar carries the lift's direction and size at a glance;
                      the number beside it carries the value. */}
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="relative h-1.5 min-w-0 flex-1 bg-line">
                      <span
                        className={`absolute top-0 h-full ${lift >= 0 ? 'bg-win' : 'bg-loss'}`}
                        style={{
                          left: lift >= 0 ? '50%' : `${50 - Math.min(Math.abs(lift), 15) * (50 / 15)}%`,
                          width: `${Math.min(Math.abs(lift), 15) * (50 / 15)}%`,
                        }}
                      />
                      <span className="absolute left-1/2 top-0 h-full w-px bg-line-strong" />
                    </span>
                    <span
                      className={`tnum w-16 shrink-0 text-right ${
                        lift >= 0 ? 'text-win' : 'text-loss'
                      }`}
                    >
                      {lift >= 0 ? '+' : ''}
                      {lift} pts
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="border-l-2 border-line-strong bg-panel px-4 py-3 text-[12px] text-ink-muted">
            No pair has three games together yet.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-[13px] text-ink">Activity</h2>
        <Card>
          <CardContent className="p-2">
            {activity ? (
              <ActivityCalendar days={activity.days} year={year} />
            ) : (
              <Skeleton className="h-[185px]" />
            )}
          </CardContent>
        </Card>
      </section>

      {pool && (
        <section>
          <h2 className="text-[13px] text-ink">Champion pool</h2>
          <p className="mb-2 text-[11px] text-ink-muted">
            <span className="tnum text-gold">{pool.played}</span> of {pool.available} champions
            played between us · {pool.untouched.length} never picked
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-px">
              {pool.champions.slice(0, 10).map((champion) => (
                <div
                  key={champion.championId}
                  className="flex items-center gap-3 bg-panel px-3 py-1.5"
                >
                  <ChampionIcon
                    championId={champion.championId}
                    championName={champion.championName}
                    staticData={staticData}
                    size={24}
                  />
                  <span className="w-24 shrink-0 truncate text-[12px] text-ink">
                    {champion.championName}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-ink-muted">
                    {champion.players
                      .slice(0, 3)
                      .map((player) => `${player.displayName} (${player.games})`)
                      .join(', ')}
                  </span>
                  <span className="tnum shrink-0 text-[11px] text-ink-dim">
                    {champion.games}g
                  </span>
                  <span
                    className={`tnum w-12 shrink-0 text-right text-[12px] ${
                      champion.winRate >= 50 ? 'text-win' : 'text-loss'
                    }`}
                  >
                    {champion.winRate}%
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-panel px-4 py-3">
              <div className="mb-2 text-[10px] uppercase tracking-[0.08em] text-ink-dim">
                Never picked by anyone
              </div>
              {pool.untouched.length === 0 ? (
                <p className="text-[12px] text-win">Every champion has been played.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {pool.untouched.map((champion) => (
                    <span
                      key={champion.championId}
                      className="flex items-center gap-1.5 bg-panel-raised px-2 py-1 text-[11px] text-ink-muted"
                    >
                      <ChampionIcon
                        championId={champion.championId}
                        championName={champion.championName}
                        staticData={staticData}
                        size={16}
                      />
                      {champion.championName}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
