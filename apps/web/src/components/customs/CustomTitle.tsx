import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { PencilIcon } from 'lucide-react'

import { api, type CustomGame } from '@/lib/api'

const TITLE_CLASS =
  'display text-[clamp(28px,6vw,46px)] font-extrabold uppercase leading-[0.95] tracking-[0.01em] text-ink'

/** Same limit as the column, so the form refuses what the server would. */
const MAX_LENGTH = 80

/**
 * The game's name, editable in place by an admin.
 *
 * Everyone else sees a plain title. Saving an empty name clears it, and the
 * page falls back to "Custom game" - the same as a capture uploaded unnamed.
 */
export function CustomTitle({
  game,
  group,
  editable,
}: {
  game: CustomGame
  group: string
  editable: boolean
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(game.label ?? '')

  const rename = useMutation({
    mutationFn: (label: string) => api.updateCustom(game.id, { label: label.trim() || null }),
    onSuccess: (saved) => {
      toast.success(saved.label ? `Renamed to “${saved.label}”.` : 'Name cleared.')
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['custom', group, String(game.id)] })
      // The list, the leaderboard, the stats and the home block all show the name.
      queryClient.invalidateQueries({ queryKey: ['customs', group] })
      queryClient.invalidateQueries({ queryKey: ['admin-customs', group] })
    },
    onError: () => toast.error('Could not save that. Are you still signed in?'),
  })

  if (!editing) {
    return (
      <div className="flex items-start gap-3">
        <h1 className={TITLE_CLASS}>{game.label ?? 'Custom game'}</h1>
        {editable && (
          <button
            type="button"
            onClick={() => {
              setDraft(game.label ?? '')
              setEditing(true)
            }}
            aria-label="Rename this game"
            className="tap mt-1 inline-flex shrink-0 items-center justify-center rounded-[4px] border border-line p-1.5 text-ink-dim transition-colors hover:border-line-strong hover:text-ink"
          >
            <PencilIcon className="size-4" aria-hidden />
          </button>
        )}
      </div>
    )
  }

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (draft.trim() === (game.label ?? '')) {
      setEditing(false)
      return
    }
    rename.mutate(draft)
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-2">
      <label htmlFor="custom-name" className="sr-only">
        Name of this game
      </label>
      <input
        id="custom-name"
        autoFocus
        value={draft}
        maxLength={MAX_LENGTH}
        placeholder="Custom game"
        disabled={rename.isPending}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          // Escape abandons the edit, the way every inline editor does.
          if (event.key === 'Escape') setEditing(false)
        }}
        className={`${TITLE_CLASS} min-w-0 flex-1 basis-[16rem] border-b-2 border-accent bg-transparent outline-none placeholder:text-ink-dim`}
      />
      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={rename.isPending}
          className="cut-tab tap display bg-accent px-4 py-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-on-accent disabled:opacity-60"
        >
          {rename.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={rename.isPending}
          className="cut-tab tap display bg-panel-raised px-4 py-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
