import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { SearchIcon } from 'lucide-react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import type { QueueScope } from '@pasen/shared'

import type { GroupMember } from '@/lib/api'
import { memberColor } from '@/lib/format'

/**
 * Jumping between members. With eleven of them the header cannot list everyone,
 * and a dropdown of eleven names is not much better than a wall of links - so
 * the roster moves behind a search box that is one keystroke away.
 */
export function PlayerSwitcher({
  group,
  members,
  scope,
}: {
  group: string
  members: GroupMember[]
  scope: QueueScope
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Cmd+K on a Mac, Ctrl+K elsewhere.
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((previous) => !previous)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const go = (to: string, params: Record<string, string>) => {
    setOpen(false)
    // Keep the active scope: jumping to a player should not reset the filter.
    navigate({ to, params, search: { scope } } as never)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        /*
         * Named explicitly, because below `sm` the only thing left in the
         * button is an aria-hidden icon - a screen reader announced "button"
         * and nothing else. The label matches the visible one word for word so
         * the two never disagree where both are present.
         */
        aria-label="Jump to…"
        className="tap flex items-center justify-center gap-2 border border-line px-2 py-1 text-[12px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
      >
        <SearchIcon className="size-3" aria-hidden />
        <span className="hidden sm:inline">Jump to…</span>
        <kbd className="tnum hidden text-[10px] text-ink-dim sm:inline">⌘K</kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Jump to"
        description="Search members and pages"
      >
        <CommandInput placeholder="Search a member or a page…" />
        <CommandList>
          <CommandEmpty>Nobody by that name.</CommandEmpty>

          <CommandGroup heading="Pages">
            <CommandItem onSelect={() => go('/$group', { group })}>Today</CommandItem>
            <CommandItem onSelect={() => go('/$group/insights', { group })}>Insights</CommandItem>
          </CommandGroup>

          <CommandGroup heading="Members">
            {members.map((member, index) => (
              <CommandItem
                key={member.slug}
                // Riot IDs are searchable too: people know each other by those
                // as often as by the nickname on the site.
                value={`${member.displayName} ${member.accounts.map((a) => a.riotId).join(' ')}`}
                onSelect={() => go('/$group/players/$member', { group, member: member.slug })}
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: memberColor(member.accentColor, index) }}
                />
                <span className="flex-1">{member.displayName}</span>
                <span className="tnum text-[11px] text-ink-dim">
                  {member.totals.games} games
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
