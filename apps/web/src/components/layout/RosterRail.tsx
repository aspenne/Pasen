import { Link } from '@tanstack/react-router'
import type { QueueScope } from '@pasen/shared'

import { DecayNote } from '@/components/DecayNote'
import type { GroupOverview } from '@/lib/api'
import { memberColor, rankedQueueFor, rankShort, tierColor, tierCrest } from '@/lib/format'
import { rosterOrder } from '@/lib/rails'

/**
 * The group in standing order, on every page: who is where on the ladder is
 * what people check most, and it used to be at the bottom of the home page.
 */
export function RosterRail({
  members,
  group,
  scope,
  playing,
}: {
  members: GroupOverview['members']
  group: string
  scope: QueueScope
  /** Members in a game right now, who get a live dot. */
  playing: Set<string>
}) {
  if (members.length === 0) return null
  const queueType = rankedQueueFor(scope)

  return (
    <section aria-labelledby="roster-rail">
      <h2 id="roster-rail" className="mb-2 flex items-baseline justify-between text-[11px] uppercase tracking-[0.15em] text-ink-dim">
        <span>Roster</span>
        <span className="tnum normal-case tracking-normal">{members.length}</span>
      </h2>
      <ol className="grid gap-px overflow-hidden rounded-[8px] border border-line bg-line min-[900px]:grid-cols-2 min-[1280px]:grid-cols-1">
        {rosterOrder(members, scope).map(({ member, index }, place) => {
          const standing = member.ranks.find((rank) => rank.queueType === queueType)
          const crest = standing?.tier ? tierCrest(standing.tier) : null
          return (
            <li key={member.slug}>
              <Link
                to="/$group/players/$member"
                params={{ group, member: member.slug }}
                search={{ scope }}
                className="flex min-w-0 items-center gap-2.5 bg-panel px-3 py-2 transition-colors hover:bg-panel-raised"
                activeProps={{ className: 'bg-panel-raised' }}
              >
                <span className="tnum w-4 shrink-0 text-right text-[11px] text-ink-dim">{place + 1}</span>
                <span
                  aria-hidden
                  className="h-6 w-0.5 shrink-0 rounded-full"
                  style={{ backgroundColor: memberColor(member.accentColor, index) }}
                />
                <span className="flex size-6 shrink-0 items-center justify-center">
                  {crest && <img src={crest} alt="" aria-hidden width={24} height={24} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] text-ink">{member.displayName}</span>
                    {playing.has(member.slug) && (
                      <span aria-label="in game" className="live-dot inline-block size-[6px] shrink-0 rounded-full bg-loss" />
                    )}
                  </span>
                  <span className="block truncate leading-tight">
                    <DecayNote decay={standing?.decay ?? null} urgentOnly />
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {scope === 'arena' ? (
                    <span className="tnum text-[11.5px] text-win">{member.totals.firstPlaces} first</span>
                  ) : scope === 'custom' ? (
                    <span className="tnum text-[11.5px] text-win">
                      {member.totals.wins} {member.totals.wins === 1 ? 'win' : 'wins'}
                    </span>
                  ) : (
                    <span className="tnum text-[11.5px]" style={{ color: standing ? tierColor(standing.tier) : undefined }}>
                      {standing ? rankShort(standing) : 'Unranked'}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
