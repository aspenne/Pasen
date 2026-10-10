import { useState } from 'react'

import type { RouletteSeat, RouletteSide } from '@/lib/api'

type Teams = Record<RouletteSide, RouletteSeat[]>
type Member = { slug: string; displayName: string; riotId: string }

const TEAM_SIZE = 5
const SIDE_LABEL: Record<RouletteSide, string> = { blue: 'Blue side', red: 'Red side' }
const other = (side: RouletteSide): RouletteSide => (side === 'blue' ? 'red' : 'blue')
const short = (seat: RouletteSeat) => seat.name.split('#')[0]

/**
 * Setting the teams by hand: for a lobby nobody had the app open in, or to
 * fix what it read. Members are added by Riot ID; the server finds their
 * account from it, so their card shows like everyone else's.
 */
export function TeamEditor({
  teams,
  members,
  onSave,
  saving,
}: {
  teams: Teams
  members: Member[]
  onSave: (teams: Teams) => void
  saving: boolean
}) {
  const [draft, setDraft] = useState<Teams>(teams)
  const [picked, setPicked] = useState('')

  const taken = new Set([...draft.blue, ...draft.red].map((seat) => seat.name.toLowerCase()))
  const available = members.filter((member) => !taken.has(member.riotId.toLowerCase()))

  const move = (side: RouletteSide, index: number) =>
    setDraft((current) => ({
      ...current,
      [side]: current[side].filter((_, i) => i !== index),
      [other(side)]: [...current[other(side)], current[side][index]],
    }))
  const remove = (side: RouletteSide, index: number) =>
    setDraft((current) => ({ ...current, [side]: current[side].filter((_, i) => i !== index) }))
  const add = (side: RouletteSide) => {
    const member = members.find((entry) => entry.slug === picked)
    if (!member) return
    setDraft((current) => ({ ...current, [side]: [...current[side], { puuid: null, name: member.riotId, bot: false }] }))
    setPicked('')
  }

  return (
    <section className="space-y-4 border border-line bg-panel px-4 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {(['blue', 'red'] as const).map((side) => (
          <div key={side} className="space-y-2">
            <h3 className={`text-[11px] uppercase tracking-[0.15em] ${side === 'blue' ? 'text-[#4f8cff]' : 'text-[#ff5a4a]'}`}>
              {SIDE_LABEL[side]} · {draft[side].length}/{TEAM_SIZE}
            </h3>
            <ul className="space-y-1">
              {draft[side].map((seat, index) => (
                <li key={`${seat.name}-${index}`} className="flex items-center gap-2 bg-panel-raised px-3 py-1.5 text-[13px]">
                  <span className="min-w-0 flex-1 truncate text-ink">{seat.name}</span>
                  <button
                    type="button"
                    aria-label={`Move ${short(seat)} to ${other(side)}`}
                    disabled={draft[other(side)].length >= TEAM_SIZE}
                    onClick={() => move(side, index)}
                    className="tap text-[11px] text-ink-dim hover:text-ink disabled:opacity-40"
                  >
                    {side === 'blue' ? '→ Red' : '← Blue'}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${short(seat)}`}
                    onClick={() => remove(side, index)}
                    className="tap text-[11px] text-ink-dim hover:text-loss"
                  >
                    Remove
                  </button>
                </li>
              ))}
              {draft[side].length === 0 && <li className="text-[12px] text-ink-dim">Nobody yet.</li>}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Member to add"
          value={picked}
          onChange={(event) => setPicked(event.target.value)}
          className="tap min-w-0 flex-1 border border-line bg-panel-raised px-2 py-1.5 text-[13px] text-ink"
        >
          <option value="">Add a member…</option>
          {available.map((member) => (
            <option key={member.slug} value={member.slug}>
              {member.displayName}
            </option>
          ))}
        </select>
        {(['blue', 'red'] as const).map((side) => (
          <button
            key={side}
            type="button"
            aria-label={`Add to ${side}`}
            disabled={!picked || draft[side].length >= TEAM_SIZE}
            onClick={() => add(side)}
            className="cut-tab tap display bg-panel-raised px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted hover:text-ink disabled:opacity-40"
          >
            {side === 'blue' ? '+ Blue' : '+ Red'}
          </button>
        ))}
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(draft)}
          className="cut-tab tap display ml-auto bg-accent px-4 py-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-on-accent disabled:opacity-60"
        >
          Save teams
        </button>
      </div>
    </section>
  )
}
