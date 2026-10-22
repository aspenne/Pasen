import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { api } from '@/lib/api'

/**
 * Which of a member's accounts they are named after across the site. Only
 * shown when there is a choice to make: one account is its own main.
 */
export function MainAccount({
  accountId,
  riotId,
  isMain,
  siblings,
}: {
  accountId: number
  riotId: string
  isMain: boolean
  /** How many accounts the member has, this one included. */
  siblings: number
}) {
  const queryClient = useQueryClient()
  const set = useMutation({
    mutationFn: () => api.setMainAccount(accountId),
    onSuccess: (member) => {
      toast.success(`Now shown as ${member.displayName}.`)
      queryClient.invalidateQueries()
    },
    onError: () => toast.error('Could not save that. Are you still signed in?'),
  })

  if (siblings < 2) return null
  if (isMain) {
    return <span className="ml-1.5 rounded-[3px] bg-accent px-1 text-[10px] uppercase tracking-[0.08em] text-on-accent">main</span>
  }
  return (
    <button
      type="button"
      aria-label={`Name the member after ${riotId}`}
      disabled={set.isPending}
      onClick={() => set.mutate()}
      className="ml-1.5 text-[10px] uppercase tracking-[0.08em] text-ink-dim underline-offset-2 hover:text-ink hover:underline disabled:opacity-60"
    >
      make main
    </button>
  )
}
