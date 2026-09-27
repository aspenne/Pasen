import { Link } from '@tanstack/react-router'

import { ChampionIcon } from '@/components/ChampionIcon'
import type { GroupChampion, StaticData } from '@/lib/api'
import type { QueueScope } from '@pasen/shared'

/**
 * Who owns each champion.
 *
 * The group has played Shen 439 times and Nøah accounts for 382 of them, which
 * makes it his in a way no per-player page can say. The bar carries that share,
 * so a champion split down the middle between two members reads as contested
 * rather than as anyone's signature.
 */
export function SignatureChampions({
  champions,
  groupSlug,
  scope,
  staticData,
  limit = 4,
}: {
  champions: GroupChampion[]
  groupSlug: string
  scope: QueueScope
  staticData?: StaticData
  limit?: number
}) {
  const top = champions.slice(0, limit)
  if (top.length === 0) return null

  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] uppercase tracking-[0.15em] text-ink-dim">
          Signature champions
        </h2>
        <Link
          to="/$group/insights"
          params={{ group: groupSlug }}
          search={{ scope }}
          className="tap inline-flex items-center justify-end text-[11px] text-ink-dim transition-colors hover:text-ink"
        >
          All champions
        </Link>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {top.map((champion) => {
          const owner = champion.players[0]
          const runnerUp = champion.players[1]
          const share = owner ? Math.round((owner.games / champion.games) * 100) : 0
          // Two members within ten points of each other own it jointly.
          const contested =
            runnerUp !== undefined && owner.games - runnerUp.games <= champion.games * 0.1

          return (
            <div
              key={champion.championId}
              className="tinted flex items-center gap-3 rounded-[8px] border border-line bg-panel px-3.5 py-3"
            >
              <ChampionIcon
                championId={champion.championId}
                championName={champion.championName}
                staticData={staticData}
                size={44}
              />

              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] text-ink">{champion.championName}</div>
                <div className="truncate text-[11px] text-ink-muted">
                  {contested ? (
                    <>
                      Split · {owner.displayName} {owner.games} / {runnerUp.displayName}{' '}
                      {runnerUp.games}
                    </>
                  ) : (
                    <>
                      {owner?.displayName} played {owner?.games} of {champion.games}
                    </>
                  )}
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-[2px] bg-line-strong">
                  <div className="h-full bg-accent" style={{ width: `${share}%` }} />
                </div>
              </div>

              <div
                className={`tnum shrink-0 text-[13px] ${
                  champion.winRate >= 50 ? 'text-win' : 'text-loss'
                }`}
              >
                {champion.winRate}%
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
