import { Link, createFileRoute, useParams, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { CustomScoreboard } from '@/components/customs/CustomScoreboard'
import { CustomTitle } from '@/components/customs/CustomTitle'
import { WinnerControl } from '@/components/customs/WinnerControl'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { useStaticData } from '@/lib/ddragon'
import { duration } from '@/lib/format'

export const Route = createFileRoute('/$group/customs/$id')({ component: CustomGamePage })

function CustomGamePage() {
  const { group, id } = useParams({ from: '/$group/customs/$id' })
  const { scope } = useSearch({ from: '/$group' })

  const { data: staticData } = useStaticData()
  const { data: overview } = useQuery({
    queryKey: ['group', group, scope],
    queryFn: () => api.group(group, { scope }),
  })
  // Shares the admin page's key: signed in there, the control shows up here.
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: api.session })
  const { data: game, isPending, error } = useQuery({
    queryKey: ['custom', group, id],
    queryFn: () => api.customGame(group, Number(id)),
    // A captured game never changes after upload.
    staleTime: Number.POSITIVE_INFINITY,
  })

  const back = (
    <Link
      to="/$group/customs"
      params={{ group }}
      search={{ scope }}
      className="tap inline-flex items-center text-[12px] text-ink-dim transition-colors hover:text-ink"
    >
      ← All customs
    </Link>
  )

  if (isPending) {
    return (
      <div className="space-y-4">
        {back}
        <Skeleton className="h-[90px]" />
        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-[380px]" />
          <Skeleton className="h-[380px]" />
        </div>
      </div>
    )
  }

  if (error || !game) {
    return (
      <div className="space-y-4">
        {back}
        <p className="border-l-2 border-loss bg-panel px-4 py-3 text-[13px] text-ink-muted">
          That custom is not in this group.
        </p>
      </div>
    )
  }

  const timezone = overview?.timezone ?? 'Europe/Paris'
  const winner = game.teams.find((team) => team.won)

  return (
    <div className="space-y-5">
      {back}

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="cut-plate display bg-accent px-3 py-0.5 text-[12px] font-bold uppercase tracking-[0.16em] text-on-accent">
            {new Date(game.playedAt).toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              timeZone: timezone,
            })}
          </span>
          {game.againstBots && (
            <span className="rounded-[3px] border border-line-strong px-1.5 text-[11px] uppercase tracking-[0.1em] text-ink-dim">
              vs bots
            </span>
          )}
        </div>

        <CustomTitle game={game} group={group} editable={Boolean(session?.authenticated)} />

        <p className="tnum text-[13px] text-ink-muted">
          {game.mapName ?? game.gameMode}
          {' · '}
          {duration(game.duration)}
          {' · started '}
          {new Date(game.playedAt).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: timezone,
          })}
          {game.firstBlood && ` · first blood ${game.firstBlood}`}
        </p>

        {/*
          Where the result came from, stated rather than implied: the capture
          only knows whether the person running the agent won, and nothing at
          all when it was saved from the window closing.
        */}
        <p className="text-[12px] text-ink-dim">
          {game.resultKnown && winner
            ? `${winner.side === 'ORDER' ? 'Blue' : 'Red'} side won${
                game.resultSource === 'manual' ? ' · decided by hand' : ' · from the capture'
              }`
            : 'The capture ended before the game did, so the result is unknown'}
          {game.capturedBy && ` · captured by ${game.capturedBy.split('#')[0]}`}
        </p>
      </header>

      {session?.authenticated && <WinnerControl game={game} group={group} />}

      <div className="grid gap-3 lg:grid-cols-2">
        {game.teams.map((team) => (
          <CustomScoreboard
            key={team.side}
            team={team}
            staticData={staticData}
            groupSlug={group}
          />
        ))}
      </div>
    </div>
  )
}
