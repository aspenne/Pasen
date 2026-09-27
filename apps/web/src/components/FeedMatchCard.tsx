import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import { ChampionIcon } from '@/components/ChampionIcon'
import { ItemRow } from '@/components/ItemRow'
import { RunePair } from '@/components/RunePair'
import { MatchScoreboard } from '@/components/MatchScoreboard'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type FeedMatch, type StaticData } from '@/lib/api'
import type { QueueScope } from '@pasen/shared'

import { clockTime, duration, kda, positionLabel, queueLabel } from '@/lib/format'

type FeedMatchCardProps = {
  match: FeedMatch
  staticData?: StaticData
  groupSlug: string
  timezone: string
  colorFor: (memberSlug: string) => string
  /** Carried onto member links, so following one keeps the same question. */
  scope: QueueScope
}

/**
 * One card per match, however many of the group were in it, with the card
 * itself tinted by the result - the convention every LoL player already reads,
 * and the reason the outcome registers before a single number does.
 *
 * A match where the group met itself gets neither tint. Colouring it by the
 * first member's result would state something false about the others, and a
 * neutral card plus a label is honest about what happened.
 */
export function FeedMatchCard({
  match,
  staticData,
  groupSlug,
  timezone,
  colorFor,
  scope,
}: FeedMatchCardProps) {
  const [open, setOpen] = useState(false)

  /*
   * A finished match never changes, so it is fetched once and kept: reopening
   * a card costs nothing, and collapsing it does not throw the answer away.
   */
  const { data: detail, isPending: detailPending } = useQuery({
    queryKey: ['match', groupSlug, match.matchId],
    queryFn: () => api.match(groupSlug, match.matchId),
    enabled: open,
    staleTime: Number.POSITIVE_INFINITY,
  })

  const results = new Set(match.members.map((member) => member.win))
  const outcome = results.size > 1 ? 'split' : match.members[0].win ? 'win' : 'loss'
  const shared = match.members.length > 1

  /*
   * A neutral panel with the result on its leading edge, rather than a wash of
   * the result colour across the whole card. Thirty of those in an evening
   * turns the feed into alternating blocks of blue and red, and the pill on
   * each line says the same thing without tinting everything around it.
   */
  const edge = {
    win: 'border-l-win',
    loss: 'border-l-loss',
    split: 'border-l-line-strong',
  }[outcome]

  return (
    <article className={`tinted overflow-hidden rounded-[8px] border border-line border-l-[3px] bg-panel ${edge}`}>
      {/*
        One card per match however many of the group were in it, so a five-stack
        is one game rather than five. The shared context is stated once above
        the rows; a lone player carries it on their own line instead.
      */}
      {shared && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3 text-[12px]">
          <div className="flex items-baseline gap-2.5">
            <span className="text-ink">{queueLabel(match.queueGroup)}</span>
            <span className="text-ink-dim">{clockTime(match.gameCreation, timezone)}</span>
            <span className="tnum text-ink-dim">{duration(match.gameDuration)}</span>
          </div>
          {outcome === 'split' && (
            <span className="text-ink-dim">Against each other</span>
          )}
        </header>
      )}

      <div className="divide-y divide-white/5">
        {match.members.map((member) => (
          /*
           * Wraps rather than squeezes. With the figures and the result both
           * held at a fixed width, the name between them was the only column
           * that could give - and on a 375px screen it gave all of it, leaving
           * a row that showed a champion and a KDA but never said who played.
           * Below `sm` the numbers drop to a line of their own and the name
           * keeps the first one.
           */
          <div
            key={member.memberSlug}
            className="flex flex-wrap items-center gap-x-3.5 gap-y-2 px-4 py-3"
          >
            <span
              aria-hidden
              className="h-9 w-[3px] shrink-0 rounded-full"
              style={{ backgroundColor: colorFor(member.memberSlug) }}
            />

            <ChampionIcon
              championId={member.championId}
              championName={member.championName}
              staticData={staticData}
              size={46}
              className="rounded-[10px]"
            />

            <div className="min-w-0 flex-1">
              <Link
                to="/$group/players/$member"
                params={{ group: groupSlug, member: member.memberSlug }}
                // Carries the active scope, so following a link does not
                // silently change the question being asked.
                search={{ scope }}
                className="display block truncate text-[15px] leading-6 font-semibold text-ink transition-colors hover:text-accent"
              >
                {member.displayName}
              </Link>
              <div className="mt-0.5 truncate text-[12px] text-ink-muted">
                {member.championName}
                {positionLabel(member.teamPosition) && ` · ${positionLabel(member.teamPosition)}`}
                {member.subteamPlacement && ` · #${member.subteamPlacement}`}
                {!shared && ` · ${queueLabel(match.queueGroup)}`}
              </div>
            </div>

            {/*
              Closes the first line on a phone, beside the name it belongs to;
              back at the end of the row from `sm` up.
            */}
            <div className="shrink-0 text-right sm:order-1 sm:w-[104px]">
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  member.win ? 'bg-win/15 text-win' : 'bg-loss/15 text-loss'
                }`}
              >
                {member.win ? 'Victory' : 'Defeat'}
              </span>
              {!shared && (
                <div className="tnum mt-1 text-[11px] text-ink-dim">
                  {clockTime(match.gameCreation, timezone)} · {duration(match.gameDuration)}
                </div>
              )}
            </div>

            <div className="flex w-full items-center justify-between gap-3.5 sm:w-auto sm:justify-end">
              <RunePair perks={member.perks} staticData={staticData} size={24} />

              <div className="hidden xl:block">
                <ItemRow items={member.items} staticData={staticData} />
              </div>

              <div className="w-[118px] shrink-0 text-right">
                <div className="display tnum text-[16px] font-bold text-ink">
                  {member.kills} / {member.deaths} / {member.assists}
                </div>
                <div className="tnum mt-0.5 text-[11px] text-ink-muted">
                  {kda(member.kills, member.deaths, member.assists)} KDA · {member.cs} cs
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Accordion
        type="single"
        collapsible
        value={open ? 'board' : ''}
        onValueChange={(value) => setOpen(value === 'board')}
      >
        <AccordionItem value="board" className="border-b-0">
          <AccordionTrigger className="tap items-center justify-center gap-1.5 rounded-none border-t border-white/5 px-4 py-2 text-[12px] font-normal text-ink-dim hover:text-ink hover:no-underline">
            {open ? 'Hide scoreboard' : 'Who else was in this game'}
          </AccordionTrigger>

          <AccordionContent className="px-[18px] pb-3.5">
            {detailPending ? (
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
    </article>
  )
}
