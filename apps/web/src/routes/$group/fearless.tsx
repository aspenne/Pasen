import { createFileRoute, useParams, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { FearlessGames } from '@/components/fearless/FearlessGames'
import { FearlessGrid } from '@/components/fearless/FearlessGrid'
import { FearlessHeader } from '@/components/fearless/FearlessHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { useStaticData } from '@/lib/ddragon'

export const Route = createFileRoute('/$group/fearless')({ component: FearlessPage })

function FearlessPage() {
  const { group } = useParams({ from: '/$group/fearless' })
  const { scope } = useSearch({ from: '/$group' })

  const { data: staticData } = useStaticData()
  const { data: overview } = useQuery({
    queryKey: ['group', group, scope],
    queryFn: () => api.group(group, { scope }),
  })
  // Shares the admin page's key: signed in there, the controls show up here.
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: api.session })
  const { data: board, isPending, isError } = useQuery({
    queryKey: ['fearless', group],
    queryFn: () => api.fearless(group),
    // Someone sends a game mid-draft: the next look at the page should have it.
    refetchInterval: (query) => (query.state.data?.night.active ? 20_000 : false),
  })

  const admin = Boolean(session?.authenticated)
  const timezone = overview?.timezone ?? 'Europe/Paris'

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[70px]" />
        <Skeleton className="h-[420px]" />
      </div>
    )
  }

  if (isError) {
    /*
     * Never the empty state: it offers the admin a Start button, and starting
     * a night ends the one that may well be running behind this error.
     */
    return (
      <p className="border-l-2 border-loss bg-panel px-4 py-3 text-[13px] text-ink-muted">
        Could not load the fearless night. Reload the page in a moment.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <FearlessHeader board={board} group={group} admin={admin} timezone={timezone} />
      {board && staticData && (
        <FearlessGrid board={board} staticData={staticData} group={group} admin={admin} />
      )}
      {board && (
        <FearlessGames
          board={board}
          staticData={staticData}
          group={group}
          scope={scope}
          admin={admin}
          timezone={timezone}
        />
      )}
    </div>
  )
}
