import { createFileRoute, useParams, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { FeedMatchCard } from '@/components/FeedMatchCard'
import {
  DuoTile,
  FearlessTile,
  KpiTile,
  LesTile,
  SignatureTile,
  WeekRhythmTile,
} from '@/components/home/BentoTiles'
import { DayBoard } from '@/components/home/DayBoard'
import { GroupHero } from '@/components/home/GroupHero'
import { Reveal } from '@/components/Reveal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { dayStandings } from '@/lib/day'
import { useStaticData } from '@/lib/ddragon'
import { memberColor } from '@/lib/format'
import { signed } from '@/lib/ladder'

/** Enough to show what kind of day it was without scrolling past it. */
const FEED_PREVIEW = 6

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
  const { scope } = useSearch({ from: '/$group' })
  const [date, setDate] = useState<string | null>(null)

  const { data: staticData } = useStaticData()
  const { data: overview } = useQuery({
    queryKey: ['group', group, scope],
    queryFn: () => api.group(group, { scope }),
  })

  const timezone = overview?.timezone ?? 'Europe/Paris'
  const today = todayIn(timezone)
  const selected = date ?? today

  const { data: feed, isPending: feedPending } = useQuery({
    queryKey: ['feed', group, selected, scope],
    queryFn: () => api.feed(group, { date: selected, scope }),
    // Matches land within a minute of a game ending, so refresh at that pace.
    refetchInterval: selected === today ? 60_000 : false,
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

  /*
   * A busy evening runs to thirty near-identical cards, which buries everything
   * under them. The day's shape is above; the rest is one click away.
   */
  const [showAll, setShowAll] = useState(false)
  const allMatches = feed?.matches ?? []
  const shownMatches = showAll ? allMatches : allMatches.slice(0, FEED_PREVIEW)
  const hiddenMatches = allMatches.length - shownMatches.length

  const standings = useMemo(() => dayStandings(feed?.matches ?? [], feed?.lp), [feed?.matches, feed?.lp])
  // Only who played: a decaying account nobody touched is not part of the day.
  const dayLp = feed?.lp ? standings.reduce((sum, standing) => sum + (standing.lp ?? 0), 0) : null

  const totals = feed?.totals
  const totalGames = overview?.members.reduce((sum, m) => sum + m.totals.games, 0) ?? 0

  // The champion the roster has played most, for the banner's backdrop.
  const { data: groupChampions } = useQuery({
    queryKey: ['group-champions', group, scope],
    queryFn: () => api.groupChampions(group, { scope }),
  })
  const { data: duos } = useQuery({
    queryKey: ['duos', group, scope],
    queryFn: () => api.duos(group, { scope }),
  })
  const { data: activity } = useQuery({
    queryKey: ['activity', group, scope],
    queryFn: () => api.activity(group, { scope }),
  })
  // Same key as the customs page, so following the link opens on a warm cache.
  const { data: customs } = useQuery({
    queryKey: ['customs', group],
    queryFn: () => api.customGames(group),
  })
  // Same key as the fearless page; the banner only shows while a night runs.
  const { data: fearless } = useQuery({
    queryKey: ['fearless', group],
    queryFn: () => api.fearless(group),
    refetchInterval: 60_000,
  })
  // Same key as the LES page.
  const { data: les } = useQuery({ queryKey: ['les', group], queryFn: () => api.les(group) })

  const nameOf = (slug: string) =>
    overview?.members.find((member) => member.slug === slug)?.displayName ?? slug
  const topChampionId = groupChampions?.champions[0]?.championId
  /** The day's most striking line, which the hero names on its own art. */
  const standout = useMemo(() => {
    const all = feed?.matches.flatMap((match) => match.members) ?? []
    if (all.length === 0) return null

    return all.reduce((best, member) => {
      const ratio = (member.kills + member.assists) / Math.max(member.deaths, 1)
      const bestRatio = (best.kills + best.assists) / Math.max(best.deaths, 1)
      return ratio > bestRatio ? member : best
    })
  }, [feed])

  const lastCustom = customs?.games[0]

  return (
    <div className="space-y-6">
      {/* The day at a glance, a tile each; the games themselves run full width below. */}
      <div className="@container">
        <div className="grid grid-cols-2 gap-3 @[640px]:grid-cols-4">
          <GroupHero
            className="col-span-full @[640px]:col-span-2 @[640px]:row-span-2"
            name={overview?.name ?? group}
            dateLabel={selected === today ? 'today' : selected}
            totals={totals}
            groupGames={totalGames}
            members={overview?.members.length ?? 0}
            standout={
              standout
                ? {
                    displayName: standout.displayName,
                    championId: standout.championId,
                    championName: standout.championName,
                    kills: standout.kills,
                    deaths: standout.deaths,
                    assists: standout.assists,
                  }
                : null
            }
            backdropChampionId={topChampionId}
            staticData={staticData}
          />

          {les && !les.event.finished && <LesTile board={les} group={group} scope={scope} />}
          <FearlessTile board={fearless} lastCustom={lastCustom} group={group} scope={scope} />

          <KpiTile
            title="Win rate"
            value={`${totals?.winRate ?? 0}%`}
            detail={`${totals?.wins ?? 0}W ${totals?.losses ?? 0}L${totals?.remakes ? ` ${totals.remakes}R` : ''}${dayLp !== null && standings.length > 0 ? ` · ${signed(dayLp)} LP` : ''} ${selected === today ? 'today' : 'that day'}`}
            tone={(totals?.games ?? 0) === 0 ? 'text-ink' : (totals?.winRate ?? 0) >= 50 ? 'text-win' : 'text-loss'}
          />
          <KpiTile
            title="Champions"
            value={totals?.championsPlayed ?? 0}
            detail={`played ${selected === today ? 'today' : 'that day'}`}
          />

          {activity && <WeekRhythmTile days={activity.days} />}
          {duos?.pairs[0] && <DuoTile pair={duos.pairs[0]} nameOf={nameOf} group={group} scope={scope} />}
          {groupChampions && groupChampions.champions.length > 0 && (
            <SignatureTile
              champions={groupChampions.champions}
              group={group}
              scope={scope}
              staticData={staticData}
              span={duos?.pairs[0] ? 2 : 4}
            />
          )}
        </div>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] text-ink">
            {selected === today ? 'Today' : selected}
          </h2>
          <div className="flex items-center gap-1 text-[11px]">
            <Button
              variant="ghost"
              size="sm"
              className="tap"
              onClick={() => setDate(shiftDate(selected, -1))}
            >
              ← Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="tap"
              onClick={() => setDate(null)}
              disabled={selected === today}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="tap"
              onClick={() => setDate(shiftDate(selected, 1))}
              disabled={selected >= today}
            >
              Next →
            </Button>
          </div>
        </div>

        <DayBoard
          standings={standings}
          group={group}
          scope={scope}
          colorFor={colorFor}
          staticData={staticData}
        />
      </section>

      <section className="space-y-2">
        {feedPending && (
          <>
            <Skeleton className="h-[120px]" />
            <Skeleton className="h-[120px]" />
          </>
        )}

        {feed?.matches.length === 0 && (
          <p className="border-l-2 border-line-strong bg-panel px-4 py-3 text-[13px] text-ink-muted">
            {selected === today
              ? 'Nobody has played yet today.'
              : `No games on ${selected}.`}
          </p>
        )}

        <Reveal token={`${selected}:${scope}`} className="space-y-2">
          {shownMatches.map((match) => (
            <FeedMatchCard
              key={match.matchId}
              match={match}
              staticData={staticData}
              groupSlug={group}
              timezone={timezone}
              colorFor={colorFor}
              scope={scope}
            />
          ))}
        </Reveal>

        {hiddenMatches > 0 && (
          <Button variant="outline" className="tap mt-2 w-full" onClick={() => setShowAll(true)}>
            See the {hiddenMatches} other {hiddenMatches === 1 ? 'game' : 'games'}
          </Button>
        )}
      </section>

      {feed && feed.matches.length > 0 && (
        <p className="text-[11px] text-ink-dim">All queues · times in {timezone}</p>
      )}
    </div>
  )
}
