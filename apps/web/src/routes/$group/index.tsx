import { createFileRoute, useParams, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { FeedMatchCard } from '@/components/FeedMatchCard'
import { LiveGameCard } from '@/components/LiveGameCard'
import { DuoHighlights } from '@/components/home/DuoHighlights'
import { GroupHero } from '@/components/home/GroupHero'
import { RosterCard } from '@/components/home/RosterCard'
import { GroupRhythm } from '@/components/home/GroupRhythm'
import { SignatureChampions } from '@/components/home/SignatureChampions'
import { Reveal } from '@/components/Reveal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { useStaticData } from '@/lib/ddragon'
import { memberColor, rankedQueueFor, rankScore } from '@/lib/format'

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

  const { data: live } = useQuery({
    queryKey: ['live', group],
    queryFn: () => api.live(group),
    // The worker polls Riot once a minute; asking more often than this would
    // only re-read the same cache entry.
    refetchInterval: 20_000,
  })

  /*
   * Best standing first, in whichever ladder the scope is about - so switching
   * to flex reorders the roster by flex.
   *
   * The original position travels with each member: their colour is assigned
   * from it, and the rule is that a colour follows the person rather than their
   * place in a list. Reordering the roster must not repaint the group.
   */
  const rosterByRank = useMemo(() => {
    const queueType = rankedQueueFor(scope)
    const entries = (overview?.members ?? []).map((member, index) => ({ member, index }))

    /*
     * Arena has no ladder, but it does have a standing: Riot counts any podium
     * as a win there, so the win rate says little and the games actually taken
     * say everything.
     */
    const standing = (entry: (typeof entries)[number]) =>
      scope === 'arena'
        ? entry.member.totals.firstPlaces
        : rankScore(entry.member.ranks.find((rank) => rank.queueType === queueType))

    return entries.sort((a, b) => {
      const difference = standing(b) - standing(a)
      // Ties keep a stable order instead of shuffling on each load.
      return difference !== 0 ? difference : a.index - b.index
    })
  }, [overview, scope])

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

  return (
    <div className="space-y-6">
      <GroupHero
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

      {live && live.games.length > 0 && (
        <section>
          <h2 className="mb-2.5 flex items-center gap-2 text-[13px] tracking-[0.04em] text-loss">
            <span aria-hidden className="live-dot inline-block size-[7px] rounded-full bg-loss" />
            IN GAME NOW · {live.games.length}
          </h2>
          <div className="space-y-2.5">
            {live.games.map((game) => (
              <LiveGameCard
                key={game.gameId}
                game={game}
                staticData={staticData}
                queueLabel={
                  staticData?.queues?.[String(game.queueId)]?.description ?? game.gameMode
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
            <Button variant="ghost" size="sm" onClick={() => setDate(shiftDate(selected, -1))}>
              ← Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDate(null)}
              disabled={selected === today}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDate(shiftDate(selected, 1))}
              disabled={selected >= today}
            >
              Next →
            </Button>
          </div>
        </div>

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
          <Button variant="outline" className="mt-2 w-full" onClick={() => setShowAll(true)}>
            See the {hiddenMatches} other {hiddenMatches === 1 ? 'game' : 'games'}
          </Button>
        )}
      </section>

      {overview && overview.members.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] text-ink">Roster</h2>
          <Reveal token={scope} className="grid gap-2 sm:grid-cols-2">
            {rosterByRank.map(({ member, index }) => (
              <RosterCard
                key={member.slug}
                member={member}
                index={index}
                groupSlug={group}
                scope={scope}
              />
            ))}
          </Reveal>
        </section>
      )}

      {/*
        Three things only this site can say, because they are about the group
        rather than any one player. Short forms here; Insights carries the full
        lists behind each link.
      */}
      {groupChampions && groupChampions.champions.length > 0 && (
        <SignatureChampions
          champions={groupChampions.champions}
          groupSlug={group}
          scope={scope}
          staticData={staticData}
        />
      )}

      {duos && duos.pairs.length > 0 && (
        <DuoHighlights
          pairs={duos.pairs}
          nameOf={nameOf}
          colorFor={colorFor}
          groupSlug={group}
          scope={scope}
        />
      )}

      {activity && <GroupRhythm days={activity.days} />}

      {feed && feed.matches.length > 0 && (
        <p className="text-[11px] text-ink-dim">
          All queues · times in {timezone}
        </p>
      )}

    </div>
  )
}
