import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { api, type FearlessBoard, type StaticData } from '@/lib/api'
import { championIcon } from '@/lib/ddragon'
import { availability, searchChampions, type ChampionEntry } from '@/lib/fearless'

/**
 * Every champion, the used-up ones struck through, answering the one question
 * a fearless draft keeps asking: "is it free?".
 *
 * A burned champion differs by form, not only colour: dimmed, desaturated and
 * crossed out, so it reads in a glance on a phone and under colour blindness.
 * Selecting a champion (tap or click) says who played it - there is no hover on
 * a phone - and, for an admin, offers the corrections.
 */
export function FearlessGrid({
  board,
  staticData,
  group,
  admin,
}: {
  board: FearlessBoard
  staticData: StaticData
  group: string
  admin: boolean
}) {
  const [query, setQuery] = useState('')
  const [hideBurned, setHideBurned] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const champions: ChampionEntry[] = useMemo(
    () =>
      Object.entries(staticData.champions).map(([id, champion]) => ({
        id: Number(id),
        name: champion.name,
        slug: champion.slug,
      })),
    [staticData]
  )
  const burnOf = useMemo(() => new Map(board.burned.map((burn) => [burn.championId, burn])), [board])
  const freed = useMemo(() => new Set(board.freed), [board])

  const found = searchChampions(champions, query)
  const shown = hideBurned ? found.filter((champion) => !burnOf.has(champion.id)) : found
  const single = query.trim() && found.length === 1 ? found[0] : null
  const selected = champions.find((champion) => champion.id === selectedId) ?? null
  const burnedCount = champions.filter((champion) => burnOf.has(champion.id)).length

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Is it free? Type a champion"
          aria-label="Search a champion"
          className="tap min-w-0 basis-full border border-line bg-panel px-3 py-2 text-[14px] sm:basis-0 sm:flex-1 text-ink placeholder:text-ink-dim focus-visible:border-accent"
        />
        <label className="tap inline-flex items-center gap-2 text-[12px] text-ink-muted">
          <input
            type="checkbox"
            checked={hideBurned}
            onChange={(event) => setHideBurned(event.target.checked)}
          />
          Hide burned
        </label>
        <span className="tnum text-[12px] text-ink-dim">
          {burnedCount} burned · {champions.length - burnedCount} free
        </span>
      </div>

      {single && (
        <p
          className={`border-l-2 bg-panel px-4 py-2.5 text-[14px] ${
            burnOf.has(single.id) ? 'border-loss text-ink' : 'border-win text-ink'
          }`}
          aria-live="polite"
        >
          {availability(single, burnOf.get(single.id))}
        </p>
      )}

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-1.5">
        {shown.map((champion) => {
          const burn = burnOf.get(champion.id)
          const src = championIcon(staticData.version, champion.slug)
          return (
            <li key={champion.id}>
              <button
                type="button"
                onClick={() => setSelectedId(champion.id === selectedId ? null : champion.id)}
                aria-pressed={champion.id === selectedId}
                aria-label={`${champion.name}, ${burn ? 'burned' : 'free'}`}
                title={availability(champion, burn)}
                className={`tap relative flex w-full flex-col items-center gap-1 p-1 transition-colors ${
                  champion.id === selectedId ? 'bg-panel-raised outline outline-1 outline-accent' : 'hover:bg-panel'
                }`}
              >
                <span className="relative block size-12 overflow-hidden rounded-[4px] bg-line-strong">
                  {src && (
                    <img
                      src={src}
                      alt=""
                      width={48}
                      height={48}
                      loading="lazy"
                      className={burn ? 'opacity-35 grayscale' : ''}
                    />
                  )}
                  {burn && (
                    // A diagonal strike: the burned state never rests on colour alone.
                    <span
                      aria-hidden
                      className="absolute left-[-15%] top-1/2 h-[2px] w-[130%] -rotate-45 bg-loss"
                    />
                  )}
                </span>
                <span
                  className={`w-full truncate text-center text-[10px] ${
                    burn ? 'text-ink-dim line-through' : 'text-ink-muted'
                  }`}
                >
                  {champion.name}
                  {freed.has(champion.id) && ' ↺'}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {shown.length === 0 && <p className="text-[13px] text-ink-dim">No champion matches “{query}”.</p>}

      {selected && (
        <SelectedChampion
          champion={selected}
          board={board}
          group={group}
          admin={admin}
          sentence={availability(selected, burnOf.get(selected.id))}
          manual={burnOf.get(selected.id)?.source === 'manual'}
          freed={freed.has(selected.id)}
          burned={burnOf.has(selected.id)}
        />
      )}
    </section>
  )
}

function SelectedChampion({
  champion,
  board,
  group,
  admin,
  sentence,
  manual,
  freed,
  burned,
}: {
  champion: ChampionEntry
  board: FearlessBoard
  group: string
  admin: boolean
  sentence: string
  manual: boolean
  freed: boolean
  burned: boolean
}) {
  const queryClient = useQueryClient()
  const save = (board: FearlessBoard) => queryClient.setQueryData(['fearless', group], board)
  const failed = () => toast.error('Could not save that. Are you still signed in?')

  const adjust = useMutation({
    mutationFn: (kind: 'burn' | 'free') => api.adjustFearless(board.night.id, champion.id, kind),
    onSuccess: save,
    onError: failed,
  })
  const forget = useMutation({
    mutationFn: () => api.unadjustFearless(board.night.id, champion.id),
    onSuccess: save,
    onError: failed,
  })
  const busy = adjust.isPending || forget.isPending

  return (
    <div className="sticky bottom-3 flex flex-wrap items-center gap-x-3 gap-y-2 border border-line bg-panel-raised px-4 py-3">
      <span className="min-w-0 flex-1 text-[13px] text-ink">{sentence}</span>
      {admin && (
        <div className="flex flex-wrap gap-1.5">
          {!burned && (
            <AdminButton disabled={busy} onClick={() => adjust.mutate('burn')}>
              Burn
            </AdminButton>
          )}
          {burned && !manual && (
            <AdminButton disabled={busy} onClick={() => adjust.mutate('free')}>
              Free
            </AdminButton>
          )}
          {(manual || freed) && (
            <AdminButton disabled={busy} onClick={() => forget.mutate()}>
              Undo correction
            </AdminButton>
          )}
        </div>
      )}
    </div>
  )
}

function AdminButton({
  children,
  disabled,
  onClick,
}: {
  children: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="cut-tab tap display bg-panel px-4 py-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-muted transition-colors hover:text-ink disabled:opacity-60"
    >
      {children}
    </button>
  )
}
