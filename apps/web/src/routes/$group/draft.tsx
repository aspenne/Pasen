import { Link, createFileRoute, useParams, useSearch } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { DRAFT_ROLES, type DraftRole, type DraftSide, type QueueScope } from '@pasen/shared'

import { RoleFilterBar } from '@/components/RoleFilterBar'
import { api, ApiError, type DraftView, type StaticData } from '@/lib/api'
import { championCentered, championIcon, useStaticData } from '@/lib/ddragon'
import {
  bansOf,
  lockError,
  picksByRole,
  previewLane,
  readSeat,
  seatStillHeld,
  secondsLeft,
  turnLabel,
  writeSeat,
} from '@/lib/draft'
import { searchChampions, type ChampionEntry } from '@/lib/fearless'
import { matchesRole, type RoleFilter } from '@/lib/roles'
import { ROLES, roleIcon } from '@/lib/roulette'

export const Route = createFileRoute('/$group/draft')({ component: DraftPage })

const SIDE_COLOR: Record<DraftSide, string> = { blue: '#4f8cff', red: '#ff5a4a' }
const SIDE_NAME: Record<DraftSide, string> = { blue: 'Blue', red: 'Red' }

type Seat = { side: DraftSide; token: string }
type Roster = Record<DraftSide, Partial<Record<DraftRole, string>>>

/**
 * A champion select laid out like one: the screen is the board. Blue's five
 * picks down the left, Red's down the right, each a full splash; the pool in
 * the middle; bans along the bottom. Every screen polls once a second, so a
 * hover or a lock shows everywhere almost at once.
 */
function DraftPage() {
  const { group } = useParams({ from: '/$group/draft' })
  const { scope } = useSearch({ from: '/$group' })
  const queryClient = useQueryClient()
  const { data: staticData } = useStaticData()
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: api.session })
  const draftQuery = useQuery({
    queryKey: ['draft', group],
    queryFn: async () => (await api.currentDraft(group)) ?? null,
    refetchInterval: 1000,
  })
  const { data: roulette } = useQuery({
    queryKey: ['roulette', group],
    queryFn: () => api.roulette(group),
    refetchInterval: 5000,
  })

  const draft = draftQuery.data ?? null
  const offset = draft ? Date.parse(draft.serverTime) - draftQuery.dataUpdatedAt : 0
  const [seat, setSeat] = useState<Seat | null>(null)
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
  const open = Boolean(draft && !draft.finishedAt)
  const roster = rosterOf(roulette)

  // The champion being considered, and the card it would fill, for everyone watching.
  const [selected, setSelected] = useState<number | null>(null)
  const [lane, setLane] = useState<DraftRole | null>(null)
  useEffect(() => {
    setSelected(null)
    setLane(null)
  }, [draft?.current?.step])
  const myTurn = Boolean(seat && draft?.current && draft.current.side === seat.side)
  const hovered = myTurn ? selected : (draft?.hover ?? null)
  const preview =
    draft?.current?.kind === 'pick' && hovered
      ? {
          side: draft.current.side,
          championId: hovered,
          lane:
            (myTurn ? lane : null) ??
            previewLane(draft.actions, draft.current.side, staticData?.champions[String(hovered)]?.positions ?? []),
        }
      : null

  return (
    <div className="flex min-h-screen flex-col gap-3 p-3 lg:h-screen lg:p-4">
      <TopBar
        group={group}
        scope={scope}
        draft={draft}
        offset={offset}
        myTurn={myTurn}
        open={open}
        admin={admin}
        onCreate={() => create.mutate()}
        onCancel={() => cancel.mutate()}
        creating={create.isPending}
      />

      {!draft ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="max-w-[46ch] text-center text-[14px] text-ink-muted">
            No draft yet. Press New draft, then each captain takes a seat - Blue or Red - on their own screen.
          </p>
        </div>
      ) : (
        <>
          {/* On a phone: the pool first, then the two sides next to each other. */}
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 lg:grid-cols-[minmax(220px,24vw)_minmax(0,1fr)_minmax(220px,24vw)]">
            <PickColumn side="blue" draft={draft} roster={roster.blue} staticData={staticData} preview={preview} />
            <Center
              draft={draft}
              seat={seat}
              myTurn={myTurn}
              admin={admin}
              group={group}
              staticData={staticData}
              selected={selected}
              lane={lane}
              onSelect={(id) => {
                setSelected(id)
                setLane(null)
                if (seat) api.hoverDraft(group, draft.id, seat.token, id).catch(() => {})
              }}
              onLane={setLane}
              onLocked={(next) => {
                setSelected(null)
                setLane(null)
                queryClient.setQueryData(['draft', group], next)
              }}
              onTake={(side) => take.mutate(side)}
              onLeave={() => leave.mutate()}
              onFree={(side) => free.mutate(side)}
              seatBusy={take.isPending || leave.isPending}
            />
            <PickColumn side="red" draft={draft} roster={roster.red} staticData={staticData} preview={preview} />
          </div>
          <BanStrip draft={draft} staticData={staticData} />
        </>
      )}
    </div>
  )
}

/** Who plays which lane on each side, from the role roulette's latest draw. */
function rosterOf(roulette: Awaited<ReturnType<typeof api.roulette>> | undefined): Roster {
  const roster: Roster = { blue: {}, red: {} }
  if (!roulette?.lobby || !roulette.draw) return roster
  for (const side of ['blue', 'red'] as const) {
    ROLES.forEach((role, laneIndex) => {
      const index = roulette.draw!.roles[side][laneIndex]
      const player = index === null || index === undefined ? undefined : roulette.lobby!.teams[side][index]
      if (player) roster[side][role.key] = player.name.split('#')[0]
    })
  }
  return roster
}

function TopBar({
  group,
  scope,
  draft,
  offset,
  myTurn,
  open,
  admin,
  onCreate,
  onCancel,
  creating,
}: {
  group: string
  scope: QueueScope
  draft: DraftView | null
  offset: number
  myTurn: boolean
  open: boolean
  admin: boolean
  onCreate: () => void
  onCancel: () => void
  creating: boolean
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!draft?.current) return
    const timer = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(timer)
  }, [draft?.current?.step])

  const current = draft?.current ?? null
  const left = draft && current ? secondsLeft(draft.stepStartedAt, offset, now) : null

  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
      <div className="space-y-1">
        <Link
          to="/$group/fearless"
          params={{ group }}
          search={{ scope }}
          className="tap inline-flex items-center text-[12px] text-ink-dim hover:text-ink"
        >
          ← Fearless
        </Link>
        <div className="display text-[clamp(22px,3vw,40px)] font-bold uppercase leading-none" style={{ color: SIDE_COLOR.blue }}>
          Blue side
        </div>
      </div>

      <div className="min-w-[10rem] text-center">
        {draft && (
          <>
            <div
              className="display text-[13px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: current ? SIDE_COLOR[current.side] : undefined }}
            >
              {myTurn && current ? `Your turn · ${current.kind}` : turnLabel(current)}
            </div>
            {left !== null && (
              <div className={`display tnum text-[44px] font-bold leading-none ${left <= 5 ? 'text-loss' : 'text-ink'}`}>
                {left}
              </div>
            )}
            {draft.burned.length > 0 && (
              <div className="mt-1 text-[11px] text-ink-dim">{draft.burned.length} burned tonight</div>
            )}
          </>
        )}
        <div className="mt-2 flex justify-center gap-2">
          {!open && (
            <Action primary disabled={creating} onClick={onCreate}>
              New draft
            </Action>
          )}
          {open && admin && <Action onClick={onCancel}>Cancel draft</Action>}
        </div>
      </div>

      <div className="text-right">
        <div className="display text-[clamp(22px,3vw,40px)] font-bold uppercase leading-none" style={{ color: SIDE_COLOR.red }}>
          Red side
        </div>
      </div>
    </header>
  )
}

function PickColumn({
  side,
  draft,
  roster,
  staticData,
  preview,
}: {
  side: DraftSide
  draft: DraftView
  roster: Partial<Record<DraftRole, string>>
  staticData: StaticData | undefined
  preview: { side: DraftSide; championId: number; lane: DraftRole | null } | null
}) {
  const picks = picksByRole(draft.actions, side)
  const picking = draft.current?.side === side && draft.current.kind === 'pick'
  return (
    <ul className="grid min-h-0 grid-cols-1 gap-2 lg:grid-rows-5" aria-label={`${SIDE_NAME[side]} picks`}>
      {ROLES.map((role) => {
        const locked = picks[role.key]
        const ghost = !locked && preview?.side === side && preview.lane === role.key ? preview.championId : null
        const championId = locked ?? ghost
        const champion = championId ? staticData?.champions[String(championId)] : undefined
        const art = championId ? championCentered(championId) : null
        // Only the card the hovered champion would fill: every free lane saying it would be noise.
        const waiting = !locked && picking && preview?.side === side && preview.lane === role.key
        return (
          <li
            key={role.key}
            className={`relative min-h-[64px] overflow-hidden border bg-panel lg:min-h-[84px] ${waiting ? 'border-accent' : 'border-line'}`}
            style={{ boxShadow: locked ? `inset 3px 0 0 ${SIDE_COLOR[side]}` : undefined }}
          >
            {art && (
              <img
                src={art}
                alt=""
                className={`absolute inset-0 size-full object-cover object-[center_22%] transition-opacity ${ghost ? 'opacity-35' : 'opacity-90'}`}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ground/90 via-ground/10 to-ground/40" />
            <div className={`absolute top-2 flex items-center gap-1.5 ${side === 'red' ? 'right-3 flex-row-reverse' : 'left-3'}`}>
              <img src={roleIcon(role.icon)} alt={role.label} width={18} height={18} />
              <span className="text-[12px] text-ink-muted">{roster[role.key] ?? role.label}</span>
            </div>
            <div
              className={`display absolute bottom-2 text-[clamp(16px,1.6vw,24px)] font-semibold leading-none text-ink ${
                side === 'red' ? 'right-3 text-right' : 'left-3'
              } ${ghost ? 'opacity-60' : ''}`}
            >
              {champion?.name ?? ''}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function Center({
  draft,
  seat,
  myTurn,
  admin,
  group,
  staticData,
  selected,
  lane,
  onSelect,
  onLane,
  onLocked,
  onTake,
  onLeave,
  onFree,
  seatBusy,
}: {
  draft: DraftView
  seat: Seat | null
  myTurn: boolean
  admin: boolean
  group: string
  staticData: StaticData | undefined
  selected: number | null
  lane: DraftRole | null
  onSelect: (id: number) => void
  onLane: (lane: DraftRole) => void
  onLocked: (next: DraftView) => void
  onTake: (side: DraftSide) => void
  onLeave: () => void
  onFree: (side: DraftSide) => void
  seatBusy: boolean
}) {
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL')

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

  const picking = myTurn && draft.current?.kind === 'pick'
  const takenLanes = draft.actions
    .filter((a) => a.side === seat?.side && a.kind === 'pick' && a.role)
    .map((a) => a.role as string)
  const freeLanes = DRAFT_ROLES.filter((r) => !takenLanes.includes(r))
  const chosen = champions.find((c) => c.id === selected)
  const laneShown = lane ?? (chosen && seat ? previewLane(draft.actions, seat.side, chosen.positions ?? []) : null)

  const lock = useMutation({
    mutationFn: () => api.lockDraft(group, draft.id, seat!.token, selected!, picking ? laneShown : null),
    onSuccess: onLocked,
    onError: (error) => toast.error(lockError(error instanceof ApiError ? error.status : 422)),
  })

  return (
    <section className="order-first col-span-2 flex min-h-0 flex-col gap-2 border border-line bg-panel/70 p-3 lg:order-none lg:col-span-1">
      {!draft.finishedAt && (
        <SeatBar draft={draft} seat={seat} admin={admin} onTake={onTake} onLeave={onLeave} onFree={onFree} busy={seatBusy} />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <RoleFilterBar value={roleFilter} onChange={setRoleFilter} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search champions"
          aria-label="Search champions"
          className="tap min-w-0 flex-1 basis-40 border border-line bg-panel-raised px-3 py-1.5 text-[13px] text-ink placeholder:text-ink-dim"
        />
      </div>

      <ul className="grid max-h-[55vh] min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2 overflow-y-auto pr-1 lg:max-h-none lg:grid-cols-[repeat(auto-fill,minmax(82px,1fr))]">
        {shown.map((champion) => {
          const out = used.has(champion.id) || burned.has(champion.id)
          const src = championIcon(staticData?.version ?? null, champion.slug)
          const highlighted = champion.id === selected || champion.id === draft.hover
          return (
            <li key={champion.id}>
              <button
                type="button"
                disabled={!myTurn || out}
                onClick={() => onSelect(champion.id)}
                aria-pressed={highlighted}
                aria-label={`${champion.name}${burned.has(champion.id) ? ', burned' : used.has(champion.id) ? ', taken' : ''}`}
                className={`group/c block w-full text-center ${myTurn && !out ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span
                  className={`relative block aspect-square overflow-hidden bg-line-strong ring-2 transition ${
                    highlighted ? 'ring-accent' : 'ring-transparent'
                  } ${myTurn && !out ? 'group-hover/c:ring-line-strong' : ''}`}
                >
                  {src && (
                    <img
                      src={src}
                      alt=""
                      loading="lazy"
                      className={`size-full transition-transform ${out ? 'opacity-25 grayscale' : myTurn ? 'group-hover/c:scale-105' : ''}`}
                    />
                  )}
                  {out && <span aria-hidden className="absolute left-[-15%] top-1/2 h-[2px] w-[130%] -rotate-45 bg-loss" />}
                </span>
                <span className={`mt-1 block truncate text-[12px] ${out ? 'text-ink-dim line-through' : 'text-ink-muted'}`}>
                  {champion.name}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {myTurn && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
          <span className="display min-w-0 flex-1 truncate text-[16px] font-semibold text-ink">
            {chosen ? chosen.name : `Choose a champion to ${draft.current!.kind}`}
          </span>
          {picking && chosen && (
            <div role="radiogroup" aria-label="Lane" className="flex gap-1">
              {ROLES.filter((r) => freeLanes.includes(r.key)).map((r) => (
                <button
                  key={r.key}
                  type="button"
                  role="radio"
                  aria-checked={laneShown === r.key}
                  aria-label={r.label}
                  title={r.label}
                  onClick={() => onLane(r.key)}
                  className={`tap p-1 ${laneShown === r.key ? 'bg-accent' : 'bg-panel-raised'}`}
                >
                  <img src={roleIcon(r.icon)} alt="" width={18} height={18} className={laneShown === r.key ? 'brightness-0' : ''} />
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

function SeatBar({
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
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
      {(['blue', 'red'] as const).map((side) => (
        <span key={side} className="inline-flex items-center gap-2">
          <span className="display font-semibold uppercase tracking-[0.12em]" style={{ color: SIDE_COLOR[side] }}>
            {SIDE_NAME[side]} captain
          </span>
          {seat?.side === side ? (
            <Action disabled={busy} onClick={onLeave}>
              Leave seat
            </Action>
          ) : draft.seats[side] ? (
            <>
              <span className="text-ink-dim">seated</span>
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
    </div>
  )
}

function BanStrip({ draft, staticData }: { draft: DraftView; staticData: StaticData | undefined }) {
  const turn = draft.current?.kind === 'ban' ? draft.current : null
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {(['blue', 'red'] as const).map((side) => (
        <ol
          key={side}
          aria-label={`${SIDE_NAME[side]} bans`}
          className={`flex gap-1.5 ${side === 'red' ? 'flex-row-reverse' : ''}`}
        >
          {bansOf(draft.actions, side).map((championId, index) => {
            const champion = championId ? staticData?.champions[String(championId)] : undefined
            const src = champion ? championIcon(staticData?.version ?? null, champion.slug) : null
            const next = turn?.side === side && championId === null && index === bansOf(draft.actions, side).indexOf(null)
            return (
              <li
                key={index}
                title={champion?.name}
                className={`relative size-[clamp(44px,4.6vw,72px)] overflow-hidden border bg-panel ${
                  next ? 'border-accent' : 'border-line'
                } ${index === 2 ? (side === 'blue' ? 'mr-3' : 'ml-3') : ''}`}
              >
                {src && (
                  <>
                    <img src={src} alt={champion?.name ?? ''} className="size-full opacity-55 grayscale" />
                    <span aria-hidden className="absolute left-[-15%] top-1/2 h-[2px] w-[130%] -rotate-45 bg-ink/70" />
                  </>
                )}
              </li>
            )
          })}
        </ol>
      ))}
    </div>
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
