import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { XIcon } from 'lucide-react'

import { api, ApiError, type AdminAccount } from '@/lib/api'

/**
 * Riot IDs an account used to go by. The daily check adds a rename on its own;
 * this is for one it never saw - a rename from before it ran. Customs played
 * under any of these names count for the member.
 */
export function PreviousNames({
  accountId,
  riotId,
  aliases,
}: {
  accountId: number
  riotId: string
  aliases: AdminAccount['aliases']
}) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-status'] })
  const add = useMutation({
    mutationFn: (value: string) => api.addAlias(accountId, value),
    onSuccess: () => {
      setDraft('')
      setAdding(false)
      toast.success('Previous name added. Customs played under it now count for this member.')
      refresh()
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError && error.status === 422
          ? 'Write it as Name#TAG.'
          : error instanceof ApiError && error.status === 409
            ? 'That name is already known for this account.'
            : 'Could not save that. Are you still signed in?'
      ),
  })
  const remove = useMutation({
    mutationFn: (id: number) => api.removeAlias(id),
    onSuccess: refresh,
    onError: () => toast.error('Could not remove that. Are you still signed in?'),
  })

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
      {aliases.map((alias) => (
        <span key={alias.id} className="inline-flex items-center gap-1 rounded-[3px] border border-line px-1.5 text-ink-dim">
          <span title={alias.source === 'riot' ? 'Found by the daily check' : 'Added by hand'}>was</span>
          <span className="text-ink-muted">{alias.riotId}</span>
          <button
            type="button"
            aria-label={`Forget ${alias.riotId}`}
            onClick={() => remove.mutate(alias.id)}
            className="text-ink-dim hover:text-loss"
          >
            <XIcon className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          aria-label="Previous Riot ID"
          value={draft}
          placeholder="Old name#TAG, Enter to save"
          disabled={add.isPending}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && draft.trim()) add.mutate(draft.trim())
            if (event.key === 'Escape') setAdding(false)
          }}
          className="h-6 w-48 border border-line bg-panel-raised px-1.5 text-[11px] text-ink placeholder:text-ink-dim"
        />
      ) : (
        <button
          type="button"
          aria-label={`Add a previous name for ${riotId}`}
          onClick={() => setAdding(true)}
          className="text-ink-dim underline-offset-2 hover:text-ink hover:underline"
        >
          + previous name
        </button>
      )}
    </div>
  )
}
