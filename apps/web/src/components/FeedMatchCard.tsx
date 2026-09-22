import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
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

  /*
   * The result still reaches the eye before any number does, but as a wash of
   * the result colour over the ground rather than an opaque slab of it. The
   * old surfaces were mixed for a lighter, bluer page; on near-black they read
   * as coloured blocks sitting on top of the site instead of part of it.
   */
  const surface = {
    win: 'border-l-2 border-l-win bg-win/[0.07]',
    loss: 'border-l-2 border-l-loss bg-loss/[0.07]',
    split: 'border-l-2 border-l-line-strong bg-panel',
  }[outcome]

  return (
    <article className={`overflow-hidden rounded-[8px] border border-line ${surface}`}>
      <header className="flex items-center justify-between gap-3 px-4 pt-3 text-[12px]">
        <div className="flex items-baseline gap-2.5">
          <span className="text-ink">{queueLabel(match.queueGroup)}</span>
          <span className="text-ink-dim">{clockTime(match.gameCreation, timezone)}</span>
          <span className="tnum text-ink-dim">{duration(match.gameDuration)}</span>
        </div>

        {outcome === 'split' ? (
          <span className="text-[12px] text-ink-dim">Against each other</span>
        ) : (
          <span className={outcome === 'win' ? 'text-win' : 'text-loss'}>
            {outcome === 'win' ? 'Victory' : 'Defeat'}
          </span>
        )}
      </header>

      <div className="divide-y divide-white/5">
        {match.members.map((member) => (
          <div key={member.memberSlug} className="flex items-center gap-3 px-4 py-3">
            <span
              aria-hidden
              className="h-8 w-[3px] shrink-0 rounded-full"
              style={{ backgroundColor: colorFor(member.memberSlug) }}
            />

            <ChampionIcon
              championId={member.championId}
              championName={member.championName}
              staticData={staticData}
              size={42}
            />

            <div className="min-w-0 flex-1">
              <Link
                to="/$group/players/$member"
                params={{ group: groupSlug, member: member.memberSlug }}
                // Carries the active scope, so following a link does not
                // silently change the question being asked.
                search={{ scope }}
                className="block truncate text-[14px] text-ink transition-colors hover:text-accent"
              >
                {member.displayName}
              </Link>
              <div className="mt-0.5 truncate text-[12px] text-ink-muted">
                {member.championName}
                {positionLabel(member.teamPosition) && ` · ${positionLabel(member.teamPosition)}`}
                {member.subteamPlacement && ` · #${member.subteamPlacement}`}
              </div>
            </div>

            <div className="hidden lg:block">
              <ItemRow items={member.items} staticData={staticData} />
            </div>

            <div className="w-[124px] shrink-0 text-right">
              <div className="display tnum text-[15px] font-semibold text-ink">
                {member.kills} / {member.deaths} / {member.assists}
              </div>
              <div className="tnum mt-0.5 text-[12px] text-ink-muted">
                {kda(member.kills, member.deaths, member.assists)} KDA · {member.cs} cs
              </div>
            </div>

            {/* Only a split card needs a per-member result; otherwise the card
                has already said it and repeating it is noise. */}
            {outcome === 'split' && (
              <span
                className={`w-[52px] shrink-0 text-right text-[13px] ${
                  member.win ? 'text-win' : 'text-loss'
                }`}
              >
                {member.win ? 'Win' : 'Loss'}
              </span>
            )}
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
          <AccordionTrigger className="items-center justify-center gap-1.5 rounded-none border-t border-white/5 px-4 py-2 text-[12px] font-normal text-ink-dim hover:text-ink hover:no-underline">
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
