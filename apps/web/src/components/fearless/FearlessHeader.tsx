import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { api, type FearlessBoard } from '@/lib/api'

/**
 * Which night this is and whether it is still running, plus - for the admin -
 * the buttons that open and close one.
 */
export function FearlessHeader({
  board,
  group,
  admin,
  timezone,
}: {
  board: FearlessBoard | null | undefined
  group: string
  admin: boolean
  timezone: string
}) {
  const queryClient = useQueryClient()
  const [label, setLabel] = useState('')
  const save = (next: FearlessBoard) => queryClient.setQueryData(['fearless', group], next)
  const failed = () => toast.error('Could not save that. Are you still signed in?')

  const start = useMutation({
    mutationFn: () => api.startFearless(group, label.trim() || undefined),
    onSuccess: (next) => {
      save(next)
      setLabel('')
      toast.success('Fearless night started.')
    },
    onError: failed,
  })
  const end = useMutation({
    mutationFn: () => api.updateFearless(board!.night.id, { ended: true }),
    onSuccess: (next) => {
      save(next)
      toast.success('Fearless night ended.')
    },
    onError: failed,
  })

  const time = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    })

  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="display text-[26px] font-bold uppercase leading-none tracking-[0.04em] text-ink">
          {board?.night.label ?? 'Fearless'}
        </h1>
        {board && (
          <span
            className={`display px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${
              board.night.active ? 'bg-accent text-on-accent' : 'border border-line-strong text-ink-dim'
            }`}
          >
            {board.night.active ? 'In progress' : 'Ended'}
          </span>
        )}
      </div>

      {board ? (
        <p className="tnum text-[13px] text-ink-muted">
          Started {time(board.night.startedAt)}
          {board.night.active ? ` · closes by itself at ${time(board.night.endsAt)}` : ` · ended ${time(board.night.endsAt)}`}
        </p>
      ) : (
        <p className="max-w-[60ch] text-[13px] text-ink-muted">
          In a fearless night, a champion played in any game is gone for everyone until the night
          ends. Once a night is running, this page shows what is still free.
        </p>
      )}

      {board?.night.active && (
        <p className="border-l-2 border-accent bg-panel px-4 py-2.5 text-[12px] text-ink-muted">
          Send each game from Pasen Capture as soon as it ends: the list updates when it arrives.
        </p>
      )}

      {admin && (
        <div className="flex flex-wrap items-center gap-2 bg-panel px-4 py-3">
          {board?.night.active ? (
            <button
              type="button"
              disabled={end.isPending}
              onClick={() => end.mutate()}
              className="cut-tab tap display bg-panel-raised px-4 py-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-muted hover:text-ink disabled:opacity-60"
            >
              End the night
            </button>
          ) : (
            <>
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                maxLength={80}
                placeholder="Name it (optional)"
                aria-label="Night name"
                className="tap min-w-0 flex-1 border border-line bg-panel-raised px-3 py-1.5 text-[13px] text-ink placeholder:text-ink-dim"
              />
              <button
                type="button"
                disabled={start.isPending}
                onClick={() => start.mutate()}
                className="cut-tab tap display bg-accent px-4 py-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-on-accent disabled:opacity-60"
              >
                Start a fearless night
              </button>
            </>
          )}
          <span className="text-[11px] text-ink-dim">Only admins see this.</span>
        </div>
      )}
    </header>
  )
}
