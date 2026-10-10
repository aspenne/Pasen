import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { DEFAULT_SCOPE } from '@pasen/shared'

import { Skeleton } from '@/components/ui/skeleton'
import { api, type GroupCard, type StaticData } from '@/lib/api'
import { profileIcon, useStaticData } from '@/lib/ddragon'
import { groupSignals, type GroupSignal } from '@/lib/directory'

export const Route = createFileRoute('/')({ component: FrontPage })

/** Avatars shown before the rest are folded into "+3". */
const FACES = 8

/**
 * The way in: every group, and what is happening in each right now.
 *
 * It used to redirect straight to the one group there was, which left the
 * PASEN mark in every header pointing back at the page you were already on.
 */
function FrontPage() {
  const { data: staticData } = useStaticData()
  const { data, isPending, isError } = useQuery({
    queryKey: ['groups'],
    queryFn: api.groups,
    // Someone starting a game should show up without a reload.
    refetchInterval: 60_000,
  })

  return (
    <div className="min-h-screen bg-ground text-ink">
      <header className="border-b border-line">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <span className="text-[13px] tracking-[0.14em] text-accent">PASEN</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="space-y-2">
          <h1 className="display text-[34px] font-bold uppercase leading-none tracking-[0.03em] text-ink">
            Groups
          </h1>
          <p className="max-w-[60ch] text-[14px] text-ink-muted">
            League of Legends stats for groups of friends: who played today, who is in a game now,
            and how the customs went.
          </p>
        </div>

        {isPending ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-[168px]" />
          </div>
        ) : isError || !data ? (
          <p className="border-l-2 border-loss bg-panel px-4 py-3 text-[13px] text-ink-muted">
            Could not load the groups. Reload the page in a moment.
          </p>
        ) : data.groups.length === 0 ? (
          <p className="bg-panel px-4 py-3 text-[13px] text-ink-muted">No group yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.groups.map((group) => (
              <li key={group.slug}>
                <GroupTile group={group} staticData={staticData} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

function GroupTile({ group, staticData }: { group: GroupCard; staticData: StaticData | undefined }) {
  const faces = group.members.slice(0, FACES)
  const more = group.members.length - faces.length

  return (
    <Link
      to="/$group"
      params={{ group: group.slug }}
      search={{ scope: DEFAULT_SCOPE }}
      className="group/tile flex h-full flex-col gap-4 border border-line bg-panel px-5 py-5 transition-colors hover:border-line-strong hover:bg-panel-raised focus-visible:border-accent"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="display min-w-0 truncate text-[26px] font-bold uppercase leading-none tracking-[0.04em] text-ink">
          {group.name}
        </h2>
        <span className="shrink-0 text-[12px] text-ink-dim transition-colors group-hover/tile:text-accent">
          Open →
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex -space-x-2" aria-hidden>
          {faces.map((member) => {
            const src = profileIcon(staticData?.version ?? null, member.profileIconId)
            return (
              <span
                key={member.slug}
                title={member.displayName}
                className="block size-8 overflow-hidden rounded-full border-2 border-panel bg-line-strong"
              >
                {src ? (
                  <img src={src} alt="" width={32} height={32} loading="lazy" />
                ) : (
                  <span className="flex size-full items-center justify-center text-[10px] text-ink-muted">
                    {member.displayName.slice(0, 2)}
                  </span>
                )}
              </span>
            )
          })}
          {more > 0 && (
            <span className="tnum flex size-8 items-center justify-center rounded-full border-2 border-panel bg-panel-raised text-[10px] text-ink-muted">
              +{more}
            </span>
          )}
        </div>
        <span className="tnum text-[12px] text-ink-muted">
          {group.members.length} member{group.members.length === 1 ? '' : 's'}
        </span>
      </div>

      <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 text-[12px]">
        {groupSignals(group).map((signal) => (
          <SignalItem key={signal.kind} signal={signal} />
        ))}
      </ul>
    </Link>
  )
}

function SignalItem({ signal }: { signal: GroupSignal }) {
  if (signal.kind === 'live') {
    return (
      <li className="flex items-center gap-1.5 text-ink">
        <span aria-hidden className="live-dot inline-block size-[7px] rounded-full bg-loss" />
        {signal.text}
      </li>
    )
  }
  if (signal.kind === 'fearless') {
    return <li className="border-l-2 border-accent pl-2 text-ink">{signal.text}</li>
  }
  return <li className={`tnum ${signal.kind === 'quiet' ? 'text-ink-dim' : 'text-ink-muted'}`}>{signal.text}</li>
}
