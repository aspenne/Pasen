import { Link, createFileRoute, useParams, useSearch } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { RoleCard } from '@/components/roulette/RoleCard'
import { TeamEditor } from '@/components/roulette/TeamEditor'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type RouletteSide, type RouletteView } from '@/lib/api'
import { useStaticData } from '@/lib/ddragon'
import { ROLES, discordText, holdReveal, revealOrder, revealedCount } from '@/lib/roulette'

export const Route = createFileRoute('/$group/roulette')({ component: RoulettePage })

const SIDES: { side: RouletteSide; label: string; color: string }[] = [
  { side: 'blue', label: 'Blue side', color: '#4f8cff' },
  { side: 'red', label: 'Red side', color: '#ff5a4a' },
]

function RoulettePage() {
  const { group } = useParams({ from: '/$group/roulette' })
  const { scope } = useSearch({ from: '/$group' })
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)

  const { data: session } = useQuery({ queryKey: ['session'], queryFn: api.session })
  const { data: staticData } = useStaticData()
  const roulette = useQuery({
    queryKey: ['roulette', group],
    queryFn: () => api.roulette(group),
    // Everyone watching sees a draw within two seconds of it being made.
    refetchInterval: 2000,
  })
  const view = roulette.data
  const lobbyId = view?.lobby?.id
  const { data: cards } = useQuery({
    queryKey: ['roulette-cards', group, lobbyId],
    queryFn: () => api.rouletteCards(group),
    enabled: lobbyId !== undefined,
    // A lobby's players do not change; a new lobby is a new key.
    staleTime: Number.POSITIVE_INFINITY,
  })
  const { data: overview } = useQuery({
    queryKey: ['group', group, scope],
    queryFn: () => api.group(group, { scope }),
    enabled: Boolean(session?.authenticated),
  })

  // The server's clock, as seen from here: the gap is measured on every poll.
  const offset = view ? Date.parse(view.serverTime) - roulette.dataUpdatedAt : 0
  const count = useRevealCount(view, offset)

  const admin = Boolean(session?.authenticated)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['roulette', group] })
  const failed = () => toast.error('Could not do that. Are you still signed in?')

  const draw = useMutation({ mutationFn: () => api.drawRoles(group), onSuccess: refresh, onError: failed })
  const save = useMutation({
    mutationFn: (teams: NonNullable<RouletteView['lobby']>['teams']) => api.setRouletteTeams(group, teams),
    onSuccess: () => {
      setEditing(false)
      toast.success('Teams saved.')
      refresh()
    },
    onError: failed,
  })

  if (roulette.isPending) return <Skeleton className="h-[600px]" />
  if (roulette.isError || !view) {
    return (
      <p className="border-l-2 border-loss bg-panel px-4 py-3 text-[13px] text-ink-muted">
        Could not load the roulette. It will try again in a moment.
      </p>
    )
  }

  const lobby = view.lobby
  const done = Boolean(view.draw) && count >= revealOrder().length
  const members =
    overview?.members.map((member) => ({
      slug: member.slug,
      displayName: member.displayName,
      riotId: member.accounts[0]?.riotId ?? member.displayName,
    })) ?? []

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Link
            to="/$group/customs"
            params={{ group }}
            search={{ scope }}
            className="tap inline-flex items-center text-[12px] text-ink-dim hover:text-ink"
          >
            ← Customs
          </Link>
          <h1 className="display text-[30px] font-bold uppercase leading-none tracking-[0.04em] text-ink">Role roulette</h1>
          <p className="text-[12px] text-ink-dim">{lobbyLine(view)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {done && (
            <ActionButton
              onClick={() =>
                navigator.clipboard
                  .writeText(discordText(view))
                  .then(() => toast.success('Copied. Paste it in Discord.'))
                  .catch(() => toast.error('Could not copy. Select the names by hand.'))
              }
            >
              Copy for Discord
            </ActionButton>
          )}
          {admin && lobby && (
            <ActionButton onClick={() => setEditing((open) => !open)}>{editing ? 'Close editor' : 'Edit teams'}</ActionButton>
          )}
          {admin && !lobby && !editing && <ActionButton onClick={() => setEditing(true)}>Set teams by hand</ActionButton>}
          {admin && lobby && (
            <ActionButton primary disabled={draw.isPending} onClick={() => draw.mutate()}>
              {view.draw ? 'Reroll' : 'Draw roles'}
            </ActionButton>
          )}
        </div>
      </header>

      {admin && editing && (
        <TeamEditor
          // A new lobby while the editor is open starts it afresh, rather than
          // saving a stale draft over the player who just joined.
          key={lobby?.id ?? 'none'}
          teams={lobby?.teams ?? { blue: [], red: [] }}
          members={members}
          saving={save.isPending}
          onSave={(teams) => save.mutate(teams)}
        />
      )}

      {!lobby ? (
        <p className="max-w-[62ch] bg-panel px-4 py-3 text-[13px] text-ink-muted">
          No lobby yet. Open a custom lobby in League with Pasen Capture running on one of the PCs, and the
          ten players show up here before you press Start{admin ? ' - or set the teams by hand.' : '.'}
        </p>
      ) : (
        SIDES.map(({ side, label, color }) => (
          <section key={side} className="space-y-2">
            <h2
              className="display flex items-center gap-3 text-[13px] font-bold uppercase tracking-[0.16em] after:h-px after:flex-1 after:bg-line"
              style={{ color }}
            >
              {label}
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {slotsFor(view, side).map((slot, lane) => (
                <li key={lane} className="h-[clamp(260px,calc((100vh-330px)/2),440px)]">
                  <RoleCard
                    side={side}
                    seat={slot.seat}
                    card={slot.seat?.puuid ? cards?.cards[slot.seat.puuid] : undefined}
                    role={slot.role}
                    revealed={slot.order !== null && slot.order < count}
                    staticData={staticData}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

/**
 * What each card of a side shows. Before a draw: the lobby's players in its
 * own order, face down. After: one card per lane, Top to Support, so lane
 * opponents sit face to face across the two rows.
 */
function slotsFor(view: RouletteView, side: RouletteSide) {
  const seats = view.lobby?.teams[side] ?? []
  if (!view.draw) {
    return seats.map((seat) => ({ seat, role: null, order: null }))
  }
  const order = revealOrder()
  return ROLES.map((role, lane) => {
    const index = view.draw!.roles[side][lane]
    return {
      seat: index === null || index === undefined ? null : (seats[index] ?? null),
      role,
      order: order.findIndex(([s, l]) => s === side && l === lane),
    }
  })
}

function lobbyLine(view: RouletteView): string {
  if (!view.lobby) return 'Waiting for a lobby'
  const at = new Date(view.lobby.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const from = view.lobby.source === 'capture' ? 'From the League client' : 'Set by hand'
  return view.lobby.stale ? `Last lobby seen at ${at} · ${from.toLowerCase()}` : `${from} · updated ${at}`
}

/** Ticks while cards are still turning, then stops. */
function useRevealCount(view: RouletteView | undefined, offset: number): number {
  const revealAt = view?.draw?.revealAt
  const [now, setNow] = useState(() => Date.now())
  const held = useRef<{ drawId: number; count: number } | null>(null)
  const measured = revealAt ? revealedCount(revealAt, offset, now) : 0
  if (view?.draw) held.current = holdReveal(held.current, view.draw.id, measured)
  const count = view?.draw ? held.current!.count : 0

  useEffect(() => {
    if (!revealAt || count >= revealOrder().length) return
    const timer = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(timer)
  }, [revealAt, count])

  return count
}

function ActionButton({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: string
  onClick: () => void
  disabled?: boolean
  primary?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`cut-tab tap display px-4 py-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors disabled:opacity-60 ${
        primary ? 'bg-accent text-on-accent' : 'bg-panel-raised text-ink-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
