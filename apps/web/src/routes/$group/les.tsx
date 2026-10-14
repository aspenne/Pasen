import { Link, createFileRoute, useParams, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { QueueScope } from '@pasen/shared'

import { StatTile } from '@/components/StatTile'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type LesBoard } from '@/lib/api'
import { profileIcon, useStaticData } from '@/lib/ddragon'
import { rankLabel, tierColor } from '@/lib/format'
import { signed } from '@/lib/ladder'
import { countdownLabel, sinceLabel } from '@/lib/les'

export const Route = createFileRoute('/$group/les')({ component: LesPage })

type Entry = LesBoard['entries'][number]

/**
 * Road to Lyon e-Sport: who has climbed most in Solo/Duo since the 1st of
 * October, and who has played. Every account counts on its own, so a smurf is
 * its own line rather than part of its owner's total.
 */
function LesPage() {
  const { group } = useParams({ from: '/$group/les' })
  const { scope } = useSearch({ from: '/$group' })
  const [sort, setSort] = useState<'lp' | 'games'>('lp')
  const { data: staticData } = useStaticData()
  const { data: board, isPending, isError } = useQuery({
    queryKey: ['les', group],
    queryFn: () => api.les(group),
    refetchInterval: 5 * 60_000,
  })

  if (isPending) return <Skeleton className="h-[520px]" />
  if (isError || !board) {
    return (
      <p className="border-l-2 border-loss bg-panel px-4 py-3 text-[13px] text-ink-muted">
        Could not load the board. Reload the page in a moment.
      </p>
    )
  }

  const played = board.entries.filter((entry) => entry.games > 0)
  const resting = board.entries.filter((entry) => entry.games === 0)
  const ordered =
    sort === 'lp'
      ? played
      : [...played].sort((a, b) => b.games - a.games || b.lpGained - a.lpGained)
  const climber = played[0]
  const grinder = [...played].sort((a, b) => b.games - a.games)[0]
  // A member with more than one account gets their Riot ID shown, to tell the lines apart.
  const accountsPerMember = new Map<string, number>()
  for (const entry of board.entries) {
    accountsPerMember.set(entry.memberSlug, (accountsPerMember.get(entry.memberSlug) ?? 0) + 1)
  }
  const endsOn = new Date(board.event.endsAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Paris',
  })

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-l-2 border-accent bg-panel px-5 py-5">
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-accent">Road to {board.event.name}</p>
          <h1 className="display text-[34px] font-bold uppercase leading-none tracking-[0.03em] text-ink">
            {countdownLabel(board.event.endsAt)}
          </h1>
          <p className="max-w-[60ch] text-[13px] text-ink-muted">
            Solo/Duo LP won since 1 October, until the LAN on {endsOn}. Every account counts on its own.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          label="LP won by the group"
          value={signed(board.totals.lpGained)}
          tone={board.totals.lpGained >= 0 ? 'win' : 'loss'}
        />
        <StatTile label="Games played" value={board.totals.games} />
        <StatTile
          label="Accounts playing"
          value={board.totals.activeAccounts}
          detail={`of ${board.totals.accounts}`}
          tone="accent"
        />
        <StatTile
          label="Best climb"
          value={climber ? `${signed(climber.lpGained)} LP` : '—'}
          detail={climber?.displayName}
          tone="win"
        />
      </div>

      {grinder && grinder !== climber && (
        <p className="text-[13px] text-ink-muted">
          Most games: <span className="text-ink">{grinder.displayName}</span>, {grinder.games} games.
        </p>
      )}

      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[11px] uppercase tracking-[0.15em] text-ink-dim">Standings</h2>
          <div role="radiogroup" aria-label="Sort by" className="flex gap-1">
            {(
              [
                ['lp', 'LP won'],
                ['games', 'Games'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={sort === value}
                onClick={() => setSort(value)}
                className={`cut-tab tap display px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                  sort === value ? 'bg-accent text-on-accent' : 'bg-panel-raised text-ink-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ol className="space-y-1.5">
          {ordered.map((entry, index) => (
            <Row
              key={entry.riotId}
              entry={entry}
              place={index + 1}
              group={group}
              scope={scope}
              version={staticData?.version ?? null}
              showRiotId={(accountsPerMember.get(entry.memberSlug) ?? 0) > 1}
            />
          ))}
          {resting.map((entry) => (
            <Row
              key={entry.riotId}
              entry={entry}
              place={null}
              group={group}
              scope={scope}
              version={staticData?.version ?? null}
              showRiotId={(accountsPerMember.get(entry.memberSlug) ?? 0) > 1}
            />
          ))}
        </ol>
      </section>
    </div>
  )
}

function Row({
  entry,
  place,
  group,
  scope,
  version,
  showRiotId,
}: {
  entry: Entry
  place: number | null
  group: string
  scope: QueueScope
  version: string | null
  showRiotId: boolean
}) {
  const icon = profileIcon(version, entry.profileIconId)
  const rank = (r: Entry['current']) => (r ? rankLabel(r) : 'Unranked')

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 bg-panel px-4 py-3">
      <span
        className={`display tnum w-6 shrink-0 text-[16px] font-semibold ${place === 1 ? 'text-accent' : 'text-ink-dim'}`}
      >
        {place ?? ''}
      </span>
      <span className="block size-9 shrink-0 overflow-hidden rounded-full bg-line-strong">
        {icon && <img src={icon} alt="" width={36} height={36} loading="lazy" />}
      </span>
      <div className="min-w-[9rem] flex-1">
        <Link
          to="/$group/players/$member"
          params={{ group, member: entry.memberSlug }}
          search={{ scope }}
          className="display block truncate text-[16px] font-semibold text-ink hover:text-accent"
        >
          {entry.displayName}
        </Link>
        <div className="truncate text-[11.5px] text-ink-dim">
          {showRiotId && <span>{entry.riotId} · </span>}
          {entry.start ? (
            <>
              <span style={{ color: tierColor(entry.start.tier) }}>{rank(entry.start)}</span>
              {' → '}
              <span style={{ color: tierColor(entry.current?.tier) }}>{rank(entry.current)}</span>
            </>
          ) : (
            'Unranked in Solo/Duo'
          )}
          {entry.since && <span> · {sinceLabel(entry.since)}</span>}
        </div>
      </div>
      <div className="ml-auto flex items-baseline gap-5 text-right">
        {entry.games > 0 ? (
          <>
            <div>
              <div className={`display tnum text-[18px] font-semibold ${entry.lpGained > 0 ? 'text-win' : entry.lpGained < 0 ? 'text-loss' : 'text-ink'}`}>
                {signed(entry.lpGained)} LP
              </div>
            </div>
            <div className="min-w-[5.5rem]">
              <div className="display tnum text-[15px] font-semibold text-ink">{entry.games} games</div>
              <div className="tnum text-[11px] text-ink-dim">
                {entry.wins}W {entry.losses}L
              </div>
            </div>
          </>
        ) : (
          <span className="text-[12px] text-ink-dim">No game yet — get on it</span>
        )}
      </div>
    </li>
  )
}
