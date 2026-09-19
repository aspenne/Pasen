import { createFileRoute, useParams, useSearch } from '@tanstack/react-router'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { PLATFORM_SHORT, SCOPE_LABELS, type Platform } from '@pasen/shared'

import { ChampionIcon } from '@/components/ChampionIcon'
import { CountUp } from '@/components/CountUp'
import { ItemRow } from '@/components/ItemRow'
import { PlayerBanner } from '@/components/PlayerBanner'
import { RankPanel } from '@/components/RankPanel'
import { Reveal } from '@/components/Reveal'
import { SortableHead } from '@/components/SortableHead'
import { StatTile } from '@/components/StatTile'
import { ChampionBars } from '@/components/charts/ChampionBars'
import { LpCurve } from '@/components/charts/LpCurve'
import { ProfileRadar } from '@/components/charts/ProfileRadar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSort } from '@/hooks/useSort'
import { api, type ChampionPoolEntry } from '@/lib/api'
import { useStaticData } from '@/lib/ddragon'
import {
  duration,
  kda,
  memberColor,
  memberHex,
  positionLabel,
  queueLabel,
  timeAgo,
} from '@/lib/format'

export const Route = createFileRoute('/$group/players/$member')({ component: MemberPage })

function MemberPage() {
  const { group, member: memberSlug } = useParams({ from: '/$group/players/$member' })
  const { scope } = useSearch({ from: '/$group' })

  const { data: staticData } = useStaticData()
  const { data: profile, isPending } = useQuery({
    queryKey: ['member', memberSlug],
    queryFn: () => api.member(memberSlug),
  })
  const { data: pool } = useQuery({
    queryKey: ['pool', memberSlug, scope],
    queryFn: () => api.championPool(memberSlug, { scope }),
  })
  const { data: overview } = useQuery({
    queryKey: ['group', group, scope],
    queryFn: () => api.group(group, { scope }),
  })
  const { data: lp } = useQuery({
    queryKey: ['lp', memberSlug],
    queryFn: () => api.lpHistory(memberSlug),
  })
  const { data: ladder } = useQuery({
    queryKey: ['ladder', memberSlug],
    queryFn: () => api.ladder(memberSlug),
    // Three whole apex leagues sit behind this; the server caches it hourly.
    staleTime: 30 * 60_000,
  })
  const { data: boards } = useQuery({
    queryKey: ['leaderboards', group, 'all', scope],
    queryFn: () => api.leaderboards(group, { period: 'all', scope }),
  })

  const history = useInfiniteQuery({
    queryKey: ['history', memberSlug, scope],
    queryFn: ({ pageParam }) => api.matches(memberSlug, { cursor: pageParam, limit: 20, scope }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })

  const rosterEntry = overview?.members.find((entry) => entry.slug === memberSlug)
  const rosterIndex = overview?.members.findIndex((entry) => entry.slug === memberSlug) ?? 0
  const totals = boards?.totals.find((entry) => entry.memberSlug === memberSlug)
  const accent = memberColor(rosterEntry?.accentColor ?? null, rosterIndex)
  // ECharts paints to canvas and cannot read a CSS variable.
  const accentHex = memberHex(rosterEntry?.accentColor ?? null, rosterIndex)
  const account = profile?.accounts[0]
  const solo = rosterEntry?.ranks.find((rank) => rank.queueType === 'RANKED_SOLO_5x5')
  const syncing = profile?.accounts.some((entry) => entry.backfillState !== 'done')

  return (
    <div className="space-y-6">
      {isPending ? (
        <Skeleton className="h-[126px] rounded-[10px]" />
      ) : (
        <PlayerBanner
          name={profile?.displayName ?? memberSlug}
          subtitle={[
            profile?.accounts.map((entry) => entry.riotId).join(' · '),
            account?.summonerLevel ? `level ${account.summonerLevel}` : null,
            solo ? `${solo.tier} ${solo.rank} · ${solo.leaguePoints} LP` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          figure={
            rosterEntry ? <CountUp value={rosterEntry.totals.winRate} decimals={1} suffix="%" /> : '—'
          }
          figureLabel={`${rosterEntry?.totals.games ?? 0} games · ${SCOPE_LABELS[scope]}`}
          profileIconId={account?.profileIconId ?? null}
          championId={pool?.entries[0]?.championId}
          staticData={staticData}
          accent={accent}
        />
      )}

      {syncing && (
        <p className="border-l-2 border-accent bg-panel px-4 py-2 text-[12px] text-ink-muted">
          Still pulling history from Riot. Numbers below will keep growing.
        </p>
      )}

      <Reveal token={scope} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          label="KDA"
          value={totals ? <CountUp value={totals.kda} decimals={2} /> : '—'}
          detail={totals ? `${totals.kills}/${totals.deaths}/${totals.assists}` : undefined}
        />
        <StatTile
          label="CS per minute"
          value={totals ? <CountUp value={totals.csPerMinute} decimals={1} /> : '—'}
        />
        <StatTile
          label="Champion pool"
          value={pool ? <CountUp value={pool.played} /> : '—'}
          detail={pool ? `of ${pool.available}` : undefined}
          tone="accent"
        />
        <StatTile
          label="Most played"
          value={pool?.entries[0]?.championName ?? '—'}
          detail={pool?.entries[0] ? `${pool.entries[0].games} games` : undefined}
        />
      </Reveal>

      <Tabs defaultValue="overview">
        <TabsList className="h-auto w-full gap-1.5 rounded-[6px] bg-panel p-1.5">
          {[
            ['overview', 'Overview'],
            ['champions', 'Champions'],
            ['history', 'Match history'],
          ].map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex-1 rounded-[4px] py-2 text-[14px] text-ink-muted data-[state=active]:bg-accent data-[state=active]:text-on-accent dark:data-[state=active]:bg-accent dark:data-[state=active]:text-on-accent"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {rosterEntry && (
            <RankPanel
              ranks={rosterEntry.ranks}
              points={lp?.points ?? []}
              trackedGames={rosterEntry.totals.games}
            />
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-baseline justify-between gap-3 space-y-0">
                <CardTitle className="text-[13px]">Ranked solo over time</CardTitle>
                {ladder?.position && (
                  <div className="text-right">
                    <div className="display tnum text-[15px] font-semibold text-ink">
                      #{ladder.position.toLocaleString('en-GB')}{' '}
                      <span className="text-[12px] text-ink-muted">
                        {PLATFORM_SHORT[ladder.platform as Platform] ?? ladder.platform}
                      </span>
                    </div>
                    {/*
                      The position is exact and matches Riot's own client. The
                      apex population is not stated: the three leagues come back
                      as 300 + 700 + exactly 10 000, which reads as Riot
                      truncating the Master league rather than as its real size.
                    */}
                    <div className="text-[11px] text-ink-dim">Master+ ladder</div>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <LpCurve points={lp?.points ?? []} queueLabel="Ranked solo" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[13px]">Shape against the group</CardTitle>
              </CardHeader>
              <CardContent>
                {totals && boards ? (
                  <ProfileRadar member={totals} roster={boards.totals} color={accentHex} />
                ) : (
                  <p className="px-4 py-6 text-center text-[12px] text-ink-muted">
                    Not enough games yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="champions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">Most played</CardTitle>
            </CardHeader>
            <CardContent>
              {pool && pool.entries.length > 0 && <ChampionBars entries={pool.entries} />}
            </CardContent>
          </Card>

          <ChampionTable entries={pool?.entries ?? []} staticData={staticData} />
        </TabsContent>

        <TabsContent value="history" className="space-y-px">
          {history.data?.pages.flatMap((page) => page.entries).map((entry) => (
            <div
              key={entry.matchId}
              className={`flex items-center gap-3 border-l-2 bg-panel px-3 py-2 ${
                entry.win ? 'border-win' : 'border-loss'
              }`}
            >
              <ChampionIcon
                championId={entry.championId}
                championName={entry.championName}
                staticData={staticData}
                size={30}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] text-ink">{entry.championName}</div>
                <div className="truncate text-[11px] text-ink-muted">
                  {queueLabel(entry.queueGroup)}
                  {positionLabel(entry.teamPosition) && ` · ${positionLabel(entry.teamPosition)}`}
                  {entry.subteamPlacement && ` · #${entry.subteamPlacement}`}
                </div>
              </div>
              <div className="hidden sm:block">
                <ItemRow items={entry.items} staticData={staticData} />
              </div>
              <div className="w-[124px] shrink-0 text-right">
                <div className="tnum text-[12px] text-ink">
                  {entry.kills}/{entry.deaths}/{entry.assists}
                </div>
                <div className="tnum text-[11px] text-ink-muted">
                  {kda(entry.kills, entry.deaths, entry.assists)} · {entry.cs} cs
                </div>
              </div>
              <div className="w-[70px] shrink-0 text-right">
                <div className="tnum text-[11px] text-ink-dim">{duration(entry.gameDuration)}</div>
                <div className="text-[11px] text-ink-dim">{timeAgo(entry.gameCreation)}</div>
              </div>
            </div>
          ))}

          {history.isPending && <Skeleton className="h-48 w-full" />}

          {history.hasNextPage && (
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={() => history.fetchNextPage()}
              disabled={history.isFetchingNextPage}
            >
              {history.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ChampionTable({
  entries,
  staticData,
}: {
  entries: ChampionPoolEntry[]
  staticData: ReturnType<typeof useStaticData>['data']
}) {
  const { sorted, key, direction, toggle } = useSort(entries, 'games')

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow>
              <SortableHead column="championName" activeKey={key} direction={direction} onSort={toggle}>
                Champion
              </SortableHead>
              <SortableHead column="games" activeKey={key} direction={direction} onSort={toggle} align="right">
                Games
              </SortableHead>
              <SortableHead column="winRate" activeKey={key} direction={direction} onSort={toggle} align="right">
                Win rate
              </SortableHead>
              <SortableHead column="kda" activeKey={key} direction={direction} onSort={toggle} align="right">
                KDA
              </SortableHead>
              <SortableHead column="averageCs" activeKey={key} direction={direction} onSort={toggle} align="right">
                CS
              </SortableHead>
              <SortableHead column="lastPlayedAt" activeKey={key} direction={direction} onSort={toggle} align="right">
                Last
              </SortableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {sorted.slice(0, 25).map((entry) => (
              <TableRow key={entry.championId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ChampionIcon
                      championId={entry.championId}
                      championName={entry.championName}
                      staticData={staticData}
                      size={22}
                    />
                    <span className="text-ink">{entry.championName}</span>
                  </div>
                </TableCell>
                <TableCell className="tnum text-right text-ink-muted">{entry.games}</TableCell>
                <TableCell>
                  {/* A win rate is a proportion, so the bar carries it and the
                      number only has to be read when you want the decimal. */}
                  <div className="flex items-center justify-end gap-2.5">
                    <div
                      className="hidden h-1 w-16 overflow-hidden rounded-[2px] bg-line-strong sm:block"
                      role="img"
                      aria-label={`${entry.winRate}% win rate`}
                    >
                      <div
                        className={`h-full ${entry.winRate >= 50 ? 'bg-win' : 'bg-loss'}`}
                        style={{ width: `${Math.min(entry.winRate, 100)}%` }}
                      />
                    </div>
                    <span
                      className={`tnum w-12 text-right ${
                        entry.winRate >= 50 ? 'text-win' : 'text-loss'
                      }`}
                    >
                      {entry.winRate}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="tnum text-right text-ink-muted">{entry.kda}</TableCell>
                <TableCell className="tnum text-right text-ink-muted">{entry.averageCs}</TableCell>
                <TableCell className="text-right text-ink-dim">
                  {timeAgo(entry.lastPlayedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
