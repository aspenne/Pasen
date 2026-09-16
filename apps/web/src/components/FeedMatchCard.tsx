import { Link } from '@tanstack/react-router'

import { ChampionIcon } from '@/components/ChampionIcon'
import { ItemRow } from '@/components/ItemRow'
import type { FeedMatch, StaticData } from '@/lib/api'
import { clockTime, duration, kda, positionLabel, queueLabel } from '@/lib/format'

type FeedMatchCardProps = {
  match: FeedMatch
  staticData?: StaticData
  groupSlug: string
  timezone: string
  colorFor: (memberSlug: string) => string
}

/**
 * One card per match, however many of the group were in it. Members are listed
 * together rather than as separate entries, which is the whole difference
 * between a group's feed and five personal histories side by side.
 */
export function FeedMatchCard({
  match,
  staticData,
  groupSlug,
  timezone,
  colorFor,
}: FeedMatchCardProps) {
  // Everyone won, everyone lost, or the group met itself.
  const results = new Set(match.members.map((member) => member.win))
  const outcome = results.size > 1 ? 'split' : match.members[0].win ? 'win' : 'loss'

  const accent =
    outcome === 'win'
      ? 'border-win'
      : outcome === 'loss'
        ? 'border-loss'
        : 'border-line-strong'

  return (
    <article className={`border-l-2 ${accent} bg-panel`}>
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
        <div className="flex items-baseline gap-2 text-[11px]">
          <span className="text-ink">{queueLabel(match.queueGroup)}</span>
          <span className="text-ink-dim">{clockTime(match.gameCreation, timezone)}</span>
          <span className="tnum text-ink-dim">{duration(match.gameDuration)}</span>
        </div>
        {outcome === 'split' && (
          <span className="text-[10px] uppercase tracking-[0.08em] text-ink-dim">
            Against each other
          </span>
        )}
      </header>

      <div className="divide-y divide-line">
        {match.members.map((member) => (
          <div key={member.memberSlug} className="flex items-center gap-3 px-4 py-2">
            <span
              aria-hidden
              className="h-7 w-0.5 shrink-0 rounded-full"
              style={{ backgroundColor: colorFor(member.memberSlug) }}
            />
            <ChampionIcon
              championId={member.championId}
              championName={member.championName}
              staticData={staticData}
            />

            <div className="min-w-0 flex-1">
              <Link
                to="/$group/players/$member"
                params={{ group: groupSlug, member: member.memberSlug }}
                className="block truncate text-[13px] text-ink hover:text-gold"
              >
                {member.displayName}
              </Link>
              <div className="truncate text-[11px] text-ink-muted">
                {member.championName}
                {positionLabel(member.teamPosition) && ` · ${positionLabel(member.teamPosition)}`}
                {member.subteamPlacement && ` · #${member.subteamPlacement}`}
              </div>
            </div>

            <div className="hidden sm:block">
              <ItemRow items={member.items} staticData={staticData} />
            </div>

            <div className="w-[132px] shrink-0 text-right">
              <div className="tnum text-[13px] text-ink">
                {member.kills}/{member.deaths}/{member.assists}
              </div>
              <div className="tnum text-[11px] text-ink-muted">
                {kda(member.kills, member.deaths, member.assists)} KDA · {member.cs} cs
              </div>
            </div>

            <span
              className={`w-6 shrink-0 text-right text-[12px] ${
                member.win ? 'text-win' : 'text-loss'
              }`}
            >
              {member.win ? 'W' : 'L'}
            </span>
          </div>
        ))}
      </div>
    </article>
  )
}
