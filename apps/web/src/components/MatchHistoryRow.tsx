import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { ChampionIcon } from '@/components/ChampionIcon'
import { ItemRow } from '@/components/ItemRow'
import { MatchScoreboard } from '@/components/MatchScoreboard'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type MatchHistoryEntry, type StaticData } from '@/lib/api'
import { duration, kda, positionLabel, queueLabel, timeAgo } from '@/lib/format'
import type { QueueScope } from '@pasen/shared'

type MatchHistoryRowProps = {
  entry: MatchHistoryEntry
  staticData?: StaticData
  groupSlug: string
  scope: QueueScope
}

/**
 * One game in a player's history, opening onto the same scoreboard the daily
 * feed uses - both sides, ten champions, their KDA and items.
 *
 * The detail is fetched only when a row is opened and then kept: a finished
 * match never changes, and a page of history holds twenty rows nobody will
 * mostly ever open.
 */
export function MatchHistoryRow({
  entry,
  staticData,
  groupSlug,
  scope,
}: MatchHistoryRowProps) {
  const [open, setOpen] = useState(false)

  const { data: detail, isPending } = useQuery({
    queryKey: ['match', groupSlug, entry.matchId],
    queryFn: () => api.match(groupSlug, entry.matchId),
    enabled: open,
    staleTime: Number.POSITIVE_INFINITY,
  })

  return (
    <div className={`border-l-2 bg-panel ${entry.win ? 'border-win' : 'border-loss'}`}>
      {/* Same wrap as the daily feed: on a phone the figures take a line of
          their own rather than squeezing the champion and the queue out. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
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

        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
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
      </div>

      <Accordion
        type="single"
        collapsible
        value={open ? 'board' : ''}
        onValueChange={(value) => setOpen(value === 'board')}
      >
        <AccordionItem value="board" className="border-b-0">
          <AccordionTrigger className="tap items-center justify-center gap-1.5 rounded-none px-3 py-1.5 text-[11px] font-normal text-ink-dim hover:text-ink hover:no-underline">
            {open ? 'Hide the scoreboard' : 'Who else was in this game'}
          </AccordionTrigger>

          <AccordionContent className="px-3 pb-3">
            {isPending ? (
              <Skeleton className="h-[184px] rounded-[6px]" />
            ) : detail ? (
              <MatchScoreboard
                detail={detail}
                staticData={staticData}
                groupSlug={groupSlug}
                scope={scope}
              />
            ) : (
              <p className="text-[12px] text-ink-dim">Scoreboard unavailable for this game.</p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
