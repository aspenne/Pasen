import { Link } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { QueueScope } from '@pasen/shared'

import { ChampionIcon } from '@/components/ChampionIcon'
import { api, type FearlessBoard, type StaticData } from '@/lib/api'

/** The night's games in the order they ended, each with the ten champions it used up. */
export function FearlessGames({
  board,
  staticData,
  group,
  scope,
  admin,
  timezone,
}: {
  board: FearlessBoard
  staticData: StaticData | undefined
  group: string
  scope: QueueScope
  admin: boolean
  timezone: string
}) {
  const queryClient = useQueryClient()
  const exclude = useMutation({
    mutationFn: (ids: number[]) => api.updateFearless(board.night.id, { excludedCustomIds: ids }),
    onSuccess: (next) => queryClient.setQueryData(['fearless', group], next),
    onError: () => toast.error('Could not save that. Are you still signed in?'),
  })

  const excludedIds = board.games.filter((game) => game.excluded).map((game) => game.id)

  if (board.games.length === 0) {
    return <p className="bg-panel px-4 py-3 text-[13px] text-ink-muted">No game sent for this night yet.</p>
  }

  return (
    <section className="space-y-1.5">
      <h2 className="text-[11px] uppercase tracking-[0.15em] text-ink-dim">Games</h2>
      <ul className="space-y-1.5">
        {board.games.map((game) => (
          <li
            key={game.id}
            className={`flex flex-wrap items-center gap-x-4 gap-y-2 bg-panel px-4 py-3 ${game.excluded ? 'opacity-60' : ''}`}
          >
            <div className="min-w-[8rem]">
              <Link
                to="/$group/customs/$id"
                params={{ group, id: String(game.id) }}
                search={{ scope }}
                className="display text-[15px] font-semibold text-ink hover:text-accent"
              >
                {game.number ? `Game ${game.number}` : 'Left out'}
              </Link>
              <div className="tnum text-[11px] text-ink-dim">
                {game.label ? `${game.label} · ` : ''}
                ended{' '}
                {new Date(game.endedAt).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: timezone,
                })}
              </div>
            </div>

            <div className="flex flex-1 flex-wrap gap-3">
              {(['ORDER', 'CHAOS'] as const).map((side) => (
                <div key={side} className="flex items-center gap-1">
                  {/* Named, not coloured: green and red already mean won and lost on this site. */}
                  <span className="mr-1 text-[10px] uppercase tracking-[0.12em] text-ink-dim">
                    {side === 'ORDER' ? 'Blue' : 'Red'}
                  </span>
                  {game.picks
                    .filter((pick) => pick.side === side)
                    // By seat: two bots can share a name and a champion.
                    .map((pick, seat) => (
                      <ChampionIcon
                        key={seat}
                        championId={pick.championId}
                        championName={`${pick.championName} · ${pick.playerName}`}
                        staticData={staticData}
                        size={28}
                      />
                    ))}
                </div>
              ))}
            </div>

            {admin && (
              <button
                type="button"
                disabled={exclude.isPending}
                onClick={() =>
                  exclude.mutate(
                    game.excluded ? excludedIds.filter((id) => id !== game.id) : [...excludedIds, game.id]
                  )
                }
                className="tap text-[12px] text-ink-dim underline-offset-2 hover:text-ink hover:underline disabled:opacity-60"
              >
                {game.excluded ? 'Count it again' : 'Leave out'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
