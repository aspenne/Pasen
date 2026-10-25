import { useQuery } from '@tanstack/react-query'

import { ChampionIcon } from '@/components/ChampionIcon'
import { api, type StaticData } from '@/lib/api'
import { bansOf } from '@/lib/draft'

/** The night's drafts, newest last: who banned and picked what, game by game. */
export function FearlessDrafts({
  group,
  nightId,
  staticData,
}: {
  group: string
  nightId: number
  staticData: StaticData | undefined
}) {
  const { data } = useQuery({
    queryKey: ['night-drafts', group, nightId],
    queryFn: () => api.nightDrafts(group, nightId),
    refetchInterval: 30_000,
  })
  const drafts = data?.drafts ?? []
  if (drafts.length === 0) return null

  return (
    <section className="space-y-1.5">
      <h2 className="text-[11px] uppercase tracking-[0.15em] text-ink-dim">Drafts</h2>
      <ul className="space-y-1.5">
        {drafts.map((draft, index) => (
          <li key={draft.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-panel px-4 py-3">
            <span className="display min-w-[5rem] text-[15px] font-semibold text-ink">
              Draft {index + 1}
              {!draft.finishedAt && <span className="ml-2 text-[11px] font-normal text-accent">live</span>}
            </span>
            {(['blue', 'red'] as const).map((side) => (
              <div key={side} className="flex items-center gap-1">
                <span className="mr-1 text-[10px] uppercase tracking-[0.12em] text-ink-dim">
                  {side === 'blue' ? 'Blue' : 'Red'}
                </span>
                {draft.actions
                  .filter((a) => a.side === side && a.kind === 'pick')
                  .map((a) => (
                    <ChampionIcon key={a.step} championId={a.championId} championName="" staticData={staticData} size={26} />
                  ))}
                <span className="ml-1 text-[10px] text-ink-dim">
                  {bansOf(draft.actions, side).filter(Boolean).length} bans
                </span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </section>
  )
}
