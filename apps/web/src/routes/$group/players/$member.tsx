import { createFileRoute, useParams } from '@tanstack/react-router'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { ChampionIcon } from '@/components/ChampionIcon'
import { ItemRow } from '@/components/ItemRow'
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
import { profileIcon, useStaticData } from '@/lib/ddragon'
import { duration, kda, memberColor, positionLabel, queueLabel, timeAgo } from '@/lib/format'

export const Route = createFileRoute('/$group/players/$member')({ component: MemberPage })

function MemberPage() {
  const { group, member: memberSlug } = useParams({ from: '/$group/players/$member' })

  const { data: staticData } = useStaticData()
  const { data: profile, isPending } = useQuery({
    queryKey: ['member', memberSlug],
    queryFn: () => api.member(memberSlug),
  })
  const { data: pool } = useQuery({
    queryKey: ['pool', memberSlug],
    queryFn: () => api.championPool(memberSlug),
  })
  const { data: overview } = useQuery({
    queryKey: ['group', group],
    queryFn: () => api.group(group),
  })
  const { data: lp } = useQuery({
    queryKey: ['lp', memberSlug],
    queryFn: () => api.lpHistory(memberSlug),
  })
  const { data: boards } = useQuery({
    queryKey: ['leaderboards', group, 'all'],
    queryFn: () => api.leaderboards(group, { period: 'all' }),
  })

  const history = useInfiniteQuery({
    queryKey: ['history', memberSlug],
    queryFn: ({ pageParam }) => api.matches(memberSlug, { cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })

  const rosterEntry = overview?.members.find((entry) => entry.slug === memberSlug)
  const rosterIndex = overview?.members.findIndex((entry) => entry.slug === memberSlug) ?? 0
  const totals = boards?.totals.find((entry) => entry.memberSlug === memberSlug)
  const accent = memberColor(rosterEntry?.accentColor ?? null, rosterIndex)
  const account = profile?.accounts[0]
  const avatar = profileIcon(staticData?.version ?? null, account?.profileIconId ?? null)
  const syncing = profile?.accounts.some((entry) => entry.backfillState !== 'done')

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        {isPending ? (
          <Skeleton className="size-14" />
        ) : (
          <div className="size-14 shrink-0 overflow-hidden rounded-sm bg-line-strong">
            {avatar && <img src={avatar} alt="" width={56} height={56} />}
          </div>
        )}

        <div className="min-w-0">
          {isPending ? (
            <>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-1.5 h-3 w-56" />
            </>
          ) : (
            <>
              <h1 className="flex items-center gap-2 truncate text-[18px] text-ink">
                <span
                  aria-hidden
                  className="h-4 w-0.5 shrink-0 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                {profile?.displayName ?? memberSlug}
              </h1>
              <p className="truncate text-[12px] text-ink-muted">
                {profile?.accounts.map((entry) => entry.riotId).join(' · ')}
                {account?.summonerLevel ? ` · level ${account.summonerLevel}` : ''}
              </p>
            </>
          )}
        </div>
      </header>

      {syncing && (
        <p className="border-l-2 border-gold bg-panel px-4 py-2 text-[12px] text-ink-muted">
          Still pulling history from Riot. Numbers below will keep growing.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Games" value={rosterEntry?.totals.games ?? 0} />
        <StatTile
          label="Win rate"
          value={rosterEntry ? `${rosterEntry.totals.winRate}%` : '—'}
          tone={rosterEntry && rosterEntry.totals.winRate >= 50 ? 'win' : 'loss'}
        />
        <StatTile
          label="Champion pool"
          value={pool ? pool.played : '—'}
          detail={pool ? `of ${pool.available}` : undefined}
          tone="gold"
        />
        <StatTile
          label="Most played"
          value={pool?.entries[0]?.championName ?? '—'}
          detail={pool?.entries[0] ? `${pool.entries[0].games} games` : undefined}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="champions">Champions</TabsTrigger>
          <TabsTrigger value="history">Match history</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {rosterEntry && rosterEntry.ranks.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-3">
              {rosterEntry.ranks.map((rank) => (
                <Card key={rank.queueType}>
                  <CardContent className="px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.08em] text-ink-dim">
                      {rank.queueType.replace(/_/g, ' ').toLowerCase()}
                    </div>
                    <div className="mt-0.5 text-[15px] text-ink">
                      {rank.tier} {rank.rank}
                    </div>
                    <div className="tnum text-[11px] text-ink-muted">
                      {rank.leaguePoints} LP · {rank.wins}W {rank.losses}L
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-[13px]">Ranked solo over time</CardTitle>
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
                  <ProfileRadar member={totals} roster={boards.totals} color={accent} />
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
                <TableCell
                  className={`tnum text-right ${entry.winRate >= 50 ? 'text-win' : 'text-loss'}`}
                >
                  {entry.winRate}%
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
