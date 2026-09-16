import { createFileRoute, useParams } from '@tanstack/react-router'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { ChampionIcon } from '@/components/ChampionIcon'
import { ItemRow } from '@/components/ItemRow'
import { StatTile } from '@/components/StatTile'
import { api } from '@/lib/api'
import { profileIcon, useStaticData } from '@/lib/ddragon'
import { duration, kda, positionLabel, queueLabel, timeAgo } from '@/lib/format'

export const Route = createFileRoute('/$group/players/$member')({ component: MemberPage })

function MemberPage() {
  const { group, member: memberSlug } = useParams({ from: '/$group/players/$member' })

  const { data: staticData } = useStaticData()
  const { data: profile } = useQuery({
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

  const history = useInfiniteQuery({
    queryKey: ['history', memberSlug],
    queryFn: ({ pageParam }) => api.matches(memberSlug, { cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })

  const rosterEntry = overview?.members.find((entry) => entry.slug === memberSlug)
  const account = profile?.accounts[0]
  const avatar = profileIcon(staticData?.version ?? null, account?.profileIconId ?? null)
  const syncing = profile?.accounts.some((entry) => entry.backfillState !== 'done')

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <div className="size-14 shrink-0 overflow-hidden rounded bg-line-strong">
          {avatar && <img src={avatar} alt="" width={56} height={56} />}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-[18px] text-ink">{profile?.displayName ?? memberSlug}</h1>
          <p className="truncate text-[12px] text-ink-muted">
            {profile?.accounts.map((entry) => entry.riotId).join(' · ')}
            {account?.summonerLevel ? ` · level ${account.summonerLevel}` : ''}
          </p>
        </div>
      </header>

      {syncing && (
        <p className="border-l-2 border-gold bg-panel px-4 py-2 text-[12px] text-ink-muted">
          Still pulling history from Riot. Numbers below will keep growing.
        </p>
      )}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
      </section>

      {rosterEntry && rosterEntry.ranks.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] text-ink">Ranked</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {rosterEntry.ranks.map((rank) => (
              <div key={rank.queueType} className="bg-panel px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.08em] text-ink-dim">
                  {rank.queueType.replace(/_/g, ' ').toLowerCase()}
                </div>
                <div className="mt-0.5 text-[15px] text-ink">
                  {rank.tier} {rank.rank}
                </div>
                <div className="tnum text-[11px] text-ink-muted">
                  {rank.leaguePoints} LP · {rank.wins}W {rank.losses}L
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-[13px] text-ink">Champions</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[12px]">
            <thead>
              <tr className="border-b border-line text-left text-[10px] uppercase tracking-[0.08em] text-ink-dim">
                <th className="py-2 font-normal">Champion</th>
                <th className="py-2 text-right font-normal">Games</th>
                <th className="py-2 text-right font-normal">Win rate</th>
                <th className="py-2 text-right font-normal">KDA</th>
                <th className="py-2 text-right font-normal">CS</th>
                <th className="py-2 text-right font-normal">Last</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {pool?.entries.slice(0, 15).map((entry) => (
                <tr key={entry.championId}>
                  <td className="py-1.5">
                    <div className="flex items-center gap-2">
                      <ChampionIcon
                        championId={entry.championId}
                        championName={entry.championName}
                        staticData={staticData}
                        size={22}
                      />
                      <span className="text-ink">{entry.championName}</span>
                    </div>
                  </td>
                  <td className="tnum py-1.5 text-right text-ink-muted">{entry.games}</td>
                  <td
                    className={`tnum py-1.5 text-right ${
                      entry.winRate >= 50 ? 'text-win' : 'text-loss'
                    }`}
                  >
                    {entry.winRate}%
                  </td>
                  <td className="tnum py-1.5 text-right text-ink-muted">{entry.kda}</td>
                  <td className="tnum py-1.5 text-right text-ink-muted">{entry.averageCs}</td>
                  <td className="py-1.5 text-right text-ink-dim">{timeAgo(entry.lastPlayedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[13px] text-ink">Match history</h2>
        <div className="space-y-px">
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
                <div className="tnum text-[11px] text-ink-dim">
                  {duration(entry.gameDuration)}
                </div>
                <div className="text-[11px] text-ink-dim">{timeAgo(entry.gameCreation)}</div>
              </div>
            </div>
          ))}
        </div>

        {history.hasNextPage && (
          <button
            type="button"
            onClick={() => history.fetchNextPage()}
            disabled={history.isFetchingNextPage}
            className="mt-3 w-full border border-line-strong px-4 py-2 text-[12px] text-ink-muted hover:text-ink disabled:opacity-50"
          >
            {history.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        )}
      </section>
    </div>
  )
}
