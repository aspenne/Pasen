import { DEFAULT_SCOPE, QUEUE_SCOPES, SCOPE_LABELS, type QueueScope } from '@pasen/shared'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * One control for the whole site. Every page reads the same scope, so a win
 * rate on the roster and a win rate on a player page always answer the same
 * question.
 *
 * "Summoner's Rift" leads because it is the default, and "Every queue" sits
 * apart at the bottom: it is the only option that mixes modes with different
 * rules, and a KDA averaged across Arena and the Rift describes neither.
 */
export function ScopeSelect({
  value,
  onChange,
}: {
  value: QueueScope
  onChange: (scope: QueueScope) => void
}) {
  const specific = QUEUE_SCOPES.filter((scope) => scope !== DEFAULT_SCOPE && scope !== 'all')

  return (
    <Select value={value} onValueChange={(next) => onChange(next as QueueScope)}>
      <SelectTrigger
        aria-label="Queue"
        className="tap h-8 w-[150px] rounded-[4px] border-line bg-panel text-[13px] sm:w-[168px]"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={DEFAULT_SCOPE}>{SCOPE_LABELS[DEFAULT_SCOPE]}</SelectItem>
        <SelectSeparator />
        {specific.map((scope) => (
          <SelectItem key={scope} value={scope}>
            {SCOPE_LABELS[scope]}
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value="all">{SCOPE_LABELS.all}</SelectItem>
      </SelectContent>
    </Select>
  )
}
