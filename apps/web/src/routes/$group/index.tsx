import { createFileRoute, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { FeedMatchCard } from '@/components/FeedMatchCard'
import { LiveGameCard } from '@/components/LiveGameCard'
import { StatTile } from '@/components/StatTile'
import { api } from '@/lib/api'
import { useStaticData } from '@/lib/ddragon'
import { memberColor } from '@/lib/format'

export const Route = createFileRoute('/$group/')({ component: Dashboard })

/** The group's own today, which is not the browser's if someone is travelling. */
function todayIn(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
}

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T12:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

function Dashboard() {
  const { group } = useParams({ from: '/$group/' })
  const [date, setDate] = useState<string | null>(null)

  const { data: staticData } = useStaticData()
  const { data: overview } = useQuery({
    queryKey: ['group', group],
    queryFn: () => api.group(group),
  })

  const timezone = overview?.timezone ?? 'Europe/Paris'
  const today = todayIn(timezone)
  const selected = date ?? today

  const { data: feed, isPending: feedPending } = useQuery({
    queryKey: ['feed', group, selected],
    queryFn: () => api.feed(group, { date: selected }),
    // Matches land within a minute of a game ending, so refresh at that pace.
    refetchInterval: selected === today ? 60_000 : false,
  })

  const { data: live } = useQuery({
    queryKey: ['live', group],
    queryFn: () => api.live(group),
    // The worker polls Riot once a minute; asking more often than this would
    // only re-read the same cache entry.
    refetchInterval: 20_000,
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

  const totals = feed?.totals
  const bestKda = useMemo(() => {
    const all = feed?.matches.flatMap((match) => match.members) ?? []
    if (all.length === 0) return null
    return all.reduce((best, member) => {
      const ratio = (member.kills + member.assists) / Math.max(member.deaths, 1)
      return ratio > best.ratio ? { ratio, name: member.displayName } : best
    }, { ratio: -1, name: '' })
  }, [feed])

  return (
    <div className="space-y-6">
      {live && live.games.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-[11px] tracking-[0.1em] text-loss">
            <span className="inline-block size-1.5 rounded-full bg-loss" />
            LIVE NOW · {live.games.length}
          </h2>
          <div className="space-y-2">
            {live.games.map((game) => (
              <LiveGameCard
                key={game.gameId}
                game={game}
                staticData={staticData}
                queueLabel={
                  staticData?.queues[String(game.queueId)]?.description ?? game.gameMode
                }
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] text-ink">
            {selected === today ? 'Today' : selected}
          </h2>
          <div className="flex items-center gap-1 text-[11px]">
            <button
              type="button"
              onClick={() => setDate(shiftDate(selected, -1))}
              className="px-2 py-1 text-ink-muted hover:text-ink"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={() => setDate(null)}
              disabled={selected === today}
              className="px-2 py-1 text-ink-muted hover:text-ink disabled:opacity-40"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDate(shiftDate(selected, 1))}
              disabled={selected >= today}
              className="px-2 py-1 text-ink-muted hover:text-ink disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="Games" value={totals?.games ?? 0} />
          <StatTile
            label="Win rate"
            value={totals?.memberGames ? `${totals.winRate}%` : '—'}
            detail={totals?.memberGames ? `${totals.wins}W ${totals.losses}L` : undefined}
            tone={totals && totals.winRate >= 50 ? 'win' : 'loss'}
          />
          <StatTile label="Champions" value={totals?.championsPlayed ?? 0} />
          <StatTile
            label="Best KDA"
            value={bestKda ? bestKda.ratio.toFixed(2) : '—'}
            detail={bestKda?.name || undefined}
            tone="gold"
          />
        </div>
      </section>

      <section className="space-y-2">
        {feedPending && <p className="text-[13px] text-ink-muted">Loading…</p>}

        {feed?.matches.length === 0 && (
          <p className="border-l-2 border-line-strong bg-panel px-4 py-3 text-[13px] text-ink-muted">
            {selected === today
              ? 'Nobody has played yet today.'
              : `No games on ${selected}.`}
          </p>
        )}

        {feed?.matches.map((match) => (
          <FeedMatchCard
            key={match.matchId}
            match={match}
            staticData={staticData}
            groupSlug={group}
            timezone={timezone}
            colorFor={colorFor}
          />
        ))}
      </section>

      {overview && overview.members.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] text-ink">Roster</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {overview.members.map((member, index) => {
              const solo = member.ranks.find((rank) => rank.queueType === 'RANKED_SOLO_5x5')
              return (
                <div key={member.slug} className="flex items-center gap-3 bg-panel px-4 py-3">
                  <span
                    aria-hidden
                    className="h-8 w-0.5 shrink-0 rounded-full"
                    style={{ backgroundColor: memberColor(member.accentColor, index) }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-ink">{member.displayName}</div>
                    <div className="truncate text-[11px] text-ink-muted">
                      {solo ? `${solo.tier} ${solo.rank} · ${solo.leaguePoints} LP` : 'Unranked'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="tnum text-[13px] text-ink">{member.totals.winRate}%</div>
                    <div className="tnum text-[11px] text-ink-muted">
                      {member.totals.games} games
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {feed && feed.matches.length > 0 && (
        <p className="text-[11px] text-ink-dim">
          All queues · times in {timezone}
        </p>
      )}

    </div>
  )
}
