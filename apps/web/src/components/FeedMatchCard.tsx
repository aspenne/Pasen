import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { ChampionIcon } from '@/components/ChampionIcon'
import { ItemRow } from '@/components/ItemRow'
import { MatchScoreboard } from '@/components/MatchScoreboard'
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

  const surface = {
    win: 'bg-win-surface border-l-[4px] border-win',
    loss: 'bg-loss-surface border-l-[4px] border-loss',
    split: 'bg-panel border-l-[4px] border-line-strong',
  }[outcome]

  return (
    <article className={`overflow-hidden rounded-[18px] ${surface}`}>
      <header className="flex items-center justify-between gap-3 px-[18px] pt-3.5 text-[13px]">
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
          <div key={member.memberSlug} className="flex items-center gap-[15px] px-[18px] py-3.5">
            <span
              aria-hidden
              className="h-9 w-[3px] shrink-0 rounded-full"
              style={{ backgroundColor: colorFor(member.memberSlug) }}
            />

            <ChampionIcon
              championId={member.championId}
              championName={member.championName}
              staticData={staticData}
              size={52}
            />

            <div className="min-w-0 flex-1">
              <Link
                to="/$group/players/$member"
                params={{ group: groupSlug, member: member.memberSlug }}
                // Carries the active scope, so following a link does not
                // silently change the question being asked.
                search={{ scope }}
                className="block truncate text-[16px] text-ink transition-colors hover:text-accent"
              >
                {member.displayName}
              </Link>
              <div className="mt-0.5 truncate text-[13px] text-ink-muted">
                {member.championName}
                {positionLabel(member.teamPosition) && ` · ${positionLabel(member.teamPosition)}`}
                {member.subteamPlacement && ` · #${member.subteamPlacement}`}
              </div>
            </div>

            <div className="hidden lg:block">
              <ItemRow items={member.items} staticData={staticData} />
            </div>

            <div className="w-[136px] shrink-0 text-right">
              <div className="tnum text-[16px] text-ink">
                {member.kills} / {member.deaths} / {member.assists}
              </div>
              <div className="tnum mt-0.5 text-[13px] text-ink-muted">
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

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-1.5 border-t border-white/5 py-2 text-[12px] text-ink-dim transition-colors hover:text-ink"
      >
        {open ? 'Hide scoreboard' : 'Who else was in this game'}
        <ChevronDown
          size={13}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-[18px] pb-3.5">
          {detailPending ? (
            <Skeleton className="h-[184px] rounded-[14px]" />
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
        </div>
      )}
    </article>
  )
}
