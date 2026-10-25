import { Link, createFileRoute, useParams, useSearch } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { DRAFT_ROLES, defaultRole, type DraftRole, type DraftSide } from '@pasen/shared'

import { RoleFilterBar } from '@/components/RoleFilterBar'
import { Skeleton } from '@/components/ui/skeleton'
import { api, ApiError, type DraftView, type StaticData } from '@/lib/api'
import { championIcon, championCentered, useStaticData } from '@/lib/ddragon'
import { bansOf, lockError, picksByRole, readSeat, seatStillHeld, secondsLeft, turnLabel, writeSeat } from '@/lib/draft'
import { searchChampions, type ChampionEntry } from '@/lib/fearless'
import { matchesRole, type RoleFilter } from '@/lib/roles'
import { ROLES, roleIcon } from '@/lib/roulette'

export const Route = createFileRoute('/$group/draft')({ component: DraftPage })

const SIDE_COLOR: Record<DraftSide, string> = { blue: '#4f8cff', red: '#ff5a4a' }
const SIDE_NAME: Record<DraftSide, string> = { blue: 'Blue', red: 'Red' }

function DraftPage() {
  const { group } = useParams({ from: '/$group/draft' })
  const { scope } = useSearch({ from: '/$group' })
  const queryClient = useQueryClient()
  const { data: staticData } = useStaticData()
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: api.session })
  const draftQuery = useQuery({
    queryKey: ['draft', group],
    queryFn: async () => (await api.currentDraft(group)) ?? null,
    // A pick shows on every screen within a second.
    refetchInterval: 1000,
  })
  const { data: roulette } = useQuery({
    queryKey: ['roulette', group],
    queryFn: () => api.roulette(group),
    refetchInterval: 5000,
  })

  const draft = draftQuery.data ?? null
  const offset = draft ? Date.parse(draft.serverTime) - draftQuery.dataUpdatedAt : 0
  const [seat, setSeat] = useState<{ side: DraftSide; token: string } | null>(null)
  useEffect(() => setSeat(draft ? readSeat(draft.id) : null), [draft?.id])
  // The admin freed this seat: stop playing as that captain, and say so once.
  useEffect(() => {
    if (draft && seat && !seatStillHeld(seat, draft)) {
      writeSeat(draft.id, null)
      setSeat(null)
      toast.info('Your seat was freed.')
    }
  }, [draft?.seats.blue, draft?.seats.red])

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['draft', group] })
  const failed = (error: unknown) =>
    toast.error(error instanceof ApiError && error.status === 409 ? 'Someone was quicker.' : 'That did not go through.')

  const create = useMutation({ mutationFn: () => api.createDraft(group), onSuccess: refresh, onError: failed })
  const take = useMutation({
    mutationFn: (side: DraftSide) => api.takeSeat(group, draft!.id, side),
    onSuccess: (answer) => {
      writeSeat(draft!.id, answer)
      setSeat(answer)
      refresh()
    },
    onError: failed,
  })
  const leave = useMutation({
    mutationFn: () => api.leaveSeat(group, draft!.id, seat!.side, seat!.token),
    onSettled: () => {
      writeSeat(draft!.id, null)
      setSeat(null)
      refresh()
    },
  })
  const cancel = useMutation({ mutationFn: () => api.cancelDraft(draft!.id), onSuccess: refresh, onError: failed })
  const free = useMutation({
    mutationFn: (side: DraftSide) => api.freeDraftSeat(draft!.id, side),
    onSuccess: refresh,
    onError: () => toast.error('Could not free that seat. Are you still signed in?'),
  })

  const admin = Boolean(session?.authenticated)
  const open = draft && !draft.finishedAt

  if (draftQuery.isPending) return <Skeleton className="h-[600px]" />

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Link
            to="/$group/fearless"
            params={{ group }}
            search={{ scope }}
            className="tap inline-flex items-center text-[12px] text-ink-dim hover:text-ink"
          >
            ← Fearless
          </Link>
          <h1 className="display text-[30px] font-bold uppercase leading-none tracking-[0.04em] text-ink">Draft</h1>
          {draft?.burned.length ? (
            <p className="text-[12px] text-ink-dim">{draft.burned.length} champions burned tonight are out.</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {!open && (
            <Action primary disabled={create.isPending} onClick={() => create.mutate()}>
              New draft
            </Action>
          )}
          {open && admin && (
            <Action disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              Cancel draft
            </Action>
          )}
        </div>
      </header>

      {!draft ? (
        <p className="bg-panel px-4 py-3 text-[13px] text-ink-muted">
          No draft yet. Start one, then each captain takes a seat - Blue or Red - on their own screen.
        </p>
      ) : (
        <>
          <Seats
            draft={draft}
            seat={seat}
            admin={admin}
            onTake={(side) => take.mutate(side)}
            onLeave={() => leave.mutate()}
            onFree={(side) => free.mutate(side)}
            busy={take.isPending || leave.isPending}
          />
          <Board
            draft={draft}
            offset={offset}
            seat={seat}
            group={group}
            staticData={staticData}
            roster={rosterOf(roulette)}
            onLocked={(next) => queryClient.setQueryData(['draft', group], next)}
          />
        </>
      )}
    </div>
  )
}

/** Who plays which lane on each side, from the role roulette's latest draw. */
function rosterOf(roulette: Awaited<ReturnType<typeof api.roulette>> | undefined) {
  const roster: Record<DraftSide, Partial<Record<DraftRole, string>>> = { blue: {}, red: {} }
  if (!roulette?.lobby || !roulette.draw) return roster
  for (const side of ['blue', 'red'] as const) {
    ROLES.forEach((role, lane) => {
      const index = roulette.draw!.roles[side][lane]
      const seat = index === null || index === undefined ? undefined : roulette.lobby!.teams[side][index]
      if (seat) roster[side][role.key] = seat.name.split('#')[0]
    })
  }
  return roster
}

function Seats({
  draft,
  seat,
  admin,
  onTake,
  onLeave,
  onFree,
  busy,
}: {
  draft: DraftView
  seat: { side: DraftSide } | null
  admin: boolean
  onTake: (side: DraftSide) => void
  onLeave: () => void
  onFree: (side: DraftSide) => void
  busy: boolean
}) {
  if (draft.finishedAt) return null
  return (
    <div className="flex flex-wrap items-center gap-2 bg-panel px-4 py-2.5 text-[12px]">
      {(['blue', 'red'] as const).map((side) => (
        <span key={side} className="inline-flex items-center gap-2">
          <span className="display font-semibold uppercase tracking-[0.12em]" style={{ color: SIDE_COLOR[side] }}>
            {SIDE_NAME[side]}
          </span>
          {seat?.side === side ? (
            <Action disabled={busy} onClick={onLeave}>
              Leave seat
            </Action>
          ) : draft.seats[side] ? (
            <>
              <span className="text-ink-dim">captain seated</span>
              {admin && (
                <button type="button" onClick={() => onFree(side)} className="tap text-ink-dim underline hover:text-ink">
                  Free seat
                </button>
              )}
            </>
          ) : (
            <Action primary disabled={busy || Boolean(seat)} onClick={() => onTake(side)}>
              {`Take ${SIDE_NAME[side]} seat`}
            </Action>
          )}
        </span>
      ))}
      {!seat && <span className="text-ink-dim">Watching. Take a seat to captain a side.</span>}
    </div>
  )
}

function Board({
  draft,
  offset,
  seat,
  group,
  staticData,
  roster,
  onLocked,
}: {
  draft: DraftView
  offset: number
  seat: { side: DraftSide; token: string } | null
  group: string
  staticData: StaticData | undefined
  roster: Record<DraftSide, Partial<Record<DraftRole, string>>>
  onLocked: (next: DraftView) => void
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!draft.current) return
    const timer = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(timer)
  }, [draft.current?.step])

  const myTurn = Boolean(seat && draft.current && draft.current.side === seat.side)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-panel px-4 py-3">
        <BanRow draft={draft} side="blue" staticData={staticData} />
        <div className="text-center">
          <div
            className="display text-[15px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: draft.current ? SIDE_COLOR[draft.current.side] : undefined }}
          >
            {myTurn ? `Your turn - ${draft.current!.kind}` : turnLabel(draft.current)}
          </div>
          {draft.current && (
            <div className="display tnum text-[26px] font-bold leading-none text-ink">
              {secondsLeft(draft.stepStartedAt, offset, now)}
            </div>
          )}
        </div>
        <BanRow draft={draft} side="red" staticData={staticData} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[210px_minmax(0,1fr)_210px]">
        <PickColumn draft={draft} side="blue" roster={roster.blue} staticData={staticData} />
        <Pool draft={draft} seat={seat} myTurn={myTurn} group={group} staticData={staticData} onLocked={onLocked} />
        <PickColumn draft={draft} side="red" roster={roster.red} staticData={staticData} />
      </div>
    </div>
  )
}

function BanRow({ draft, side, staticData }: { draft: DraftView; side: DraftSide; staticData: StaticData | undefined }) {
  return (
    <div className="flex gap-1" aria-label={`${SIDE_NAME[side]} bans`}>
      {bansOf(draft.actions, side).map((championId, index) => {
        const champion = championId ? staticData?.champions[String(championId)] : undefined
        const src = champion ? championIcon(staticData?.version ?? null, champion.slug) : null
        return (
          <span
            key={index}
            title={champion?.name}
            className="relative block size-9 overflow-hidden border bg-ground"
            style={{ borderColor: SIDE_COLOR[side] }}
          >
            {src && <img src={src} alt={champion?.name ?? ''} width={36} height={36} className="opacity-60 grayscale" />}
          </span>
        )
      })}
    </div>
  )
}

function PickColumn({
  draft,
  side,
  roster,
  staticData,
}: {
  draft: DraftView
  side: DraftSide
  roster: Partial<Record<DraftRole, string>>
  staticData: StaticData | undefined
}) {
  const picks = picksByRole(draft.actions, side)
  const hovering = draft.current?.side === side && draft.current.kind === 'pick' ? draft.hover : null
  return (
    <ul className="space-y-1.5" aria-label={`${SIDE_NAME[side]} picks`}>
      {ROLES.map((role) => {
        const championId = picks[role.key]
        const champion = championId ? staticData?.champions[String(championId)] : undefined
        const art = championId ? championCentered(championId) : null
        return (
          <li
            key={role.key}
            className="relative flex h-[68px] items-center gap-2 overflow-hidden border-l-2 bg-panel px-3"
            style={{ borderColor: SIDE_COLOR[side] }}
          >
            {art && <img src={art} alt="" className="absolute inset-0 size-full object-cover object-[center_25%] opacity-50" />}
            <img src={roleIcon(role.icon)} alt={role.label} width={20} height={20} className="relative" />
            <div className="relative min-w-0">
              <div className="display truncate text-[14px] font-semibold text-ink">
                {champion?.name ?? (hovering && !championId ? '…' : '')}
              </div>
              <div className="truncate text-[11px] text-ink-muted">{roster[role.key] ?? role.label}</div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function Pool({
  draft,
  seat,
  myTurn,
  group,
  staticData,
  onLocked,
}: {
  draft: DraftView
  seat: { side: DraftSide; token: string } | null
  myTurn: boolean
  group: string
  staticData: StaticData | undefined
  onLocked: (next: DraftView) => void
}) {
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL')
  const [selected, setSelected] = useState<number | null>(null)
  const [role, setRole] = useState<DraftRole | null>(null)
  useEffect(() => {
    setSelected(null)
    setRole(null)
  }, [draft.current?.step])

  const champions: ChampionEntry[] = useMemo(
    () =>
      Object.entries(staticData?.champions ?? {}).map(([id, c]) => ({
        id: Number(id),
        name: c.name,
        slug: c.slug,
        positions: c.positions ?? [],
      })),
    [staticData]
  )
  const used = new Set(draft.actions.map((action) => action.championId))
  const burned = new Set(draft.burned)
  const shown = searchChampions(champions, query).filter((c) => matchesRole(c.positions, roleFilter))

  const takenRoles = draft.actions
    .filter((a) => a.side === seat?.side && a.kind === 'pick' && a.role)
    .map((a) => a.role as string)
  const freeRoles = DRAFT_ROLES.filter((r) => !takenRoles.includes(r))
  const picking = myTurn && draft.current?.kind === 'pick'
  const selectedChampion = champions.find((c) => c.id === selected)
  const lane = role ?? (selectedChampion ? defaultRole(selectedChampion.positions ?? [], takenRoles) : null)

  const lock = useMutation({
    mutationFn: () => api.lockDraft(group, draft.id, seat!.token, selected!, picking ? lane : null),
    onSuccess: (next) => {
      // Shown at once, so the same side playing twice in a row cannot lock the same click twice.
      setSelected(null)
      setRole(null)
      onLocked(next)
    },
    onError: (error) => toast.error(lockError(error instanceof ApiError ? error.status : 422)),
  })

  const choose = (id: number) => {
    if (!myTurn || used.has(id) || burned.has(id)) return
    setSelected(id)
    setRole(null)
    api.hoverDraft(group, draft.id, seat!.token, id).catch(() => {})
  }

  return (
    <section className="space-y-2 bg-panel p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a champion"
          aria-label="Search a champion"
          className="tap min-w-0 basis-full border border-line bg-panel-raised px-3 py-1.5 text-[13px] text-ink placeholder:text-ink-dim sm:basis-0 sm:flex-1"
        />
        <RoleFilterBar value={roleFilter} onChange={setRoleFilter} />
      </div>

      <ul className="grid max-h-[420px] grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1 overflow-y-auto pr-1">
        {shown.map((champion) => {
          const out = used.has(champion.id) || burned.has(champion.id)
          const src = championIcon(staticData?.version ?? null, champion.slug)
          const highlighted = champion.id === selected || champion.id === draft.hover
          return (
            <li key={champion.id}>
              <button
                type="button"
                disabled={!myTurn || out}
                onClick={() => choose(champion.id)}
                aria-label={`${champion.name}${burned.has(champion.id) ? ', burned' : used.has(champion.id) ? ', taken' : ''}`}
                title={champion.name}
                className={`relative block w-full p-0.5 ${highlighted ? 'outline outline-2 outline-accent' : ''} ${myTurn && !out ? 'hover:bg-panel-raised' : ''}`}
              >
                <span className="relative block aspect-square overflow-hidden bg-line-strong">
                  {src && <img src={src} alt="" loading="lazy" className={out ? 'opacity-30 grayscale' : ''} />}
                  {out && <span aria-hidden className="absolute left-[-15%] top-1/2 h-[2px] w-[130%] -rotate-45 bg-loss" />}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {myTurn && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
          <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
            {selectedChampion ? selectedChampion.name : `Pick a champion to ${draft.current!.kind}`}
          </span>
          {picking && selectedChampion && (
            <div role="radiogroup" aria-label="Lane" className="flex gap-1">
              {ROLES.filter((r) => freeRoles.includes(r.key)).map((r) => (
                <button
                  key={r.key}
                  type="button"
                  role="radio"
                  aria-checked={lane === r.key}
                  aria-label={r.label}
                  title={r.label}
                  onClick={() => setRole(r.key)}
                  className={`tap p-1 ${lane === r.key ? 'bg-accent' : 'bg-panel-raised'}`}
                >
                  <img src={roleIcon(r.icon)} alt="" width={18} height={18} className={lane === r.key ? 'brightness-0' : ''} />
                </button>
              ))}
            </div>
          )}
          <Action primary disabled={!selected || lock.isPending} onClick={() => lock.mutate()}>
            Lock in
          </Action>
        </div>
      )}
    </section>
  )
}

function Action({
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
      className={`cut-tab tap display px-4 py-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors disabled:opacity-50 ${
        primary ? 'bg-accent text-on-accent' : 'bg-panel-raised text-ink-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
