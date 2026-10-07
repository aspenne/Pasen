import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { api, type CustomGame, type CustomSide } from '@/lib/api'

type Choice = CustomSide | null

const CHOICES: { value: Choice; label: string }[] = [
  { value: 'ORDER', label: 'Blue won' },
  { value: 'CHAOS', label: 'Red won' },
  { value: null, label: 'Go by the capture' },
]

/**
 * Lets an admin settle who won.
 *
 * The capture only knows the result from the seat of whoever ran the agent,
 * and nothing at all when it was saved from the window closing - so the person
 * who was there decides. "Go by the capture" undoes a decision without anyone
 * having to remember what the capture said.
 */
export function WinnerControl({ game, group }: { game: CustomGame; group: string }) {
  const queryClient = useQueryClient()

  const current: Choice =
    game.resultSource === 'manual' ? (game.teams.find((team) => team.won)?.side ?? null) : null

  const decide = useMutation({
    mutationFn: (winner: Choice) => api.updateCustom(game.id, { winner }),
    onSuccess: (_, winner) => {
      toast.success(
        winner === null
          ? 'Back to what the capture says.'
          : `${winner === 'ORDER' ? 'Blue' : 'Red'} side set as the winner.`
      )
      queryClient.invalidateQueries({ queryKey: ['custom', group, String(game.id)] })
      queryClient.invalidateQueries({ queryKey: ['customs', group] })
    },
    onError: () => toast.error('Could not save that. Are you still signed in?'),
  })

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-panel px-4 py-3">
      <span className="text-[12px] text-ink-muted">Who won?</span>
      <div role="radiogroup" aria-label="Winner" className="flex flex-wrap gap-1.5">
        {CHOICES.map((choice) => {
          const active = current === choice.value
          return (
            <button
              key={choice.label}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={decide.isPending}
              onClick={() => !active && decide.mutate(choice.value)}
              className={`cut-tab tap display px-4 py-1 text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors disabled:opacity-60 ${
                active
                  ? 'bg-accent text-on-accent'
                  : 'bg-panel-raised text-ink-muted hover:text-ink'
              }`}
            >
              {choice.label}
            </button>
          )
        })}
      </div>
      <span className="text-[11px] text-ink-dim">Only admins see this.</span>
    </div>
  )
}
