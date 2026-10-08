import { Link } from '@tanstack/react-router'

import { DecayNote } from '@/components/DecayNote'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import type { GroupOverview } from '@/lib/api'
import { memberColor, rankedQueueFor, rankLabel, tierColor, tierCrest } from '@/lib/format'
import type { QueueScope } from '@pasen/shared'

type Member = GroupOverview['members'][number]

/**
 * A roster entry, with the rest of what we know about the person one hover
 * away.
 *
 * The row can only carry a rank and a win rate before it stops being a row.
 * Everything else - their other queues, their record on each - is a click away
 * on their page, which is a lot of ceremony for "how is Azizes doing in flex".
 */
export function RosterCard({
  member,
  index,
  groupSlug,
  scope,
}: {
  member: Member
  index: number
  groupSlug: string
  scope: QueueScope
}) {
  // The standing the scope is asking about, so flex shows a flex rank.
  const standing = member.ranks.find((rank) => rank.queueType === rankedQueueFor(scope))
  const crest = standing?.tier ? tierCrest(standing.tier) : null

  return (
    <HoverCard openDelay={180} closeDelay={80}>
      <HoverCardTrigger asChild>
        <Link
          to="/$group/players/$member"
          params={{ group: groupSlug, member: member.slug }}
          search={{ scope }}
          className="tinted flex min-w-0 items-center gap-3 rounded-[6px] border border-line bg-panel px-3.5 py-3 transition-colors hover:border-line-strong hover:bg-panel-raised"
        >
          <span
            aria-hidden
            className="h-8 w-0.5 shrink-0 rounded-full"
            style={{ backgroundColor: memberColor(member.accentColor, index) }}
          />
          {crest && <img src={crest} alt="" aria-hidden width={26} height={26} className="shrink-0" />}

          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] text-ink">{member.displayName}</span>
            {/* Tinted by tier, but the tier is written out - the colours alone
                do not separate Master from Diamond. */}
            <span
              className="block truncate text-[11px]"
              style={{ color: standing ? tierColor(standing.tier) : undefined }}
            >
              {standing ? rankLabel(standing) : 'Unranked'}
            </span>
            {/* Only when it is about to cost them something: twenty-six lines
                of "decays in 27 days" would say nothing at all. */}
            <DecayNote decay={standing?.decay ?? null} urgentOnly />
          </span>

          <span className="text-right">
            {/* In Arena the win rate counts podiums, so the firsts lead instead. */}
            {scope === 'arena' ? (
              <>
                <span className="tnum block text-[13px] text-win">
                  {member.totals.firstPlaces} first
                </span>
                <span className="tnum block text-[11px] text-ink-muted">
                  {member.totals.games} games
                </span>
              </>
            ) : scope === 'custom' ? (
              <>
                <span className="tnum block text-[13px] text-win">
                  {member.totals.wins} {member.totals.wins === 1 ? 'win' : 'wins'}
                </span>
                <span className="tnum block text-[11px] text-ink-muted">
                  {member.totals.games} inhouse{member.totals.games === 1 ? '' : 's'}
                </span>
              </>
            ) : (
              <>
                <span className="tnum block text-[13px] text-ink">{member.totals.winRate}%</span>
                <span className="tnum block text-[11px] text-ink-muted">
                  {member.totals.games} games
                </span>
              </>
            )}
          </span>
        </Link>
      </HoverCardTrigger>

      <HoverCardContent className="w-64 border-line bg-panel-solid p-3.5" sideOffset={8}>
        <div className="text-[14px] text-ink">{member.displayName}</div>
        <div className="mt-0.5 truncate text-[11px] text-ink-dim">
          {member.accounts.map((account) => account.riotId).join(' · ')}
        </div>

        <dl className="mt-3 space-y-1.5">
          {member.ranks.length === 0 && (
            <div className="text-[12px] text-ink-muted">No ranked standing yet.</div>
          )}
          {member.ranks.map((rank) => {
            const played = rank.wins + rank.losses
            return (
              <div key={rank.queueType} className="flex items-baseline justify-between gap-3">
                <dt className="truncate text-[11px] text-ink-dim">
                  {rank.queueType.replace(/_/g, ' ').toLowerCase()}
                </dt>
                <dd className="shrink-0 text-right">
                  <span className="text-[12px]" style={{ color: tierColor(rank.tier) }}>
                    {rankLabel(rank)}
                  </span>
                  <span className="tnum ml-2 text-[11px] text-ink-muted">
                    {played > 0 ? `${Math.round((rank.wins / played) * 100)}%` : '—'}
                  </span>
                </dd>
              </div>
            )
          })}
        </dl>

        <div className="mt-3 border-t border-line pt-2.5 text-[11px] text-ink-dim">
          {member.totals.games} games tracked · {member.totals.championsPlayed} champions
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
