import { Link } from '@tanstack/react-router'
import type { QueueScope } from '@pasen/shared'

import { ChampionIcon } from '@/components/ChampionIcon'
import type { StaticData } from '@/lib/api'
import type { DayStanding } from '@/lib/day'
import { kda } from '@/lib/format'

/** More than this and the row wraps on a phone; the rest is in the games below. */
const CHAMPIONS_SHOWN = 4

/**
 * Who played on the day and how it went, so nobody has to add up the cards
 * below to find out.
 */
export function DayBoard({
  standings,
  group,
  scope,
  colorFor,
  staticData,
}: {
  standings: DayStanding[]
  group: string
  scope: QueueScope
  colorFor: (memberSlug: string) => string
  staticData?: StaticData
}) {
  if (standings.length === 0) return null

  return (
    <ol className="grid gap-px overflow-hidden rounded-[8px] border border-line bg-line">
      {standings.map((standing, place) => {
        const extra = standing.champions.length - CHAMPIONS_SHOWN
        return (
          <li key={standing.memberSlug}>
            <Link
              to="/$group/players/$member"
              params={{ group, member: standing.memberSlug }}
              search={{ scope }}
              className="flex min-w-0 items-center gap-2.5 bg-panel px-3 py-2 transition-colors hover:bg-panel-raised"
            >
              <span className={`tnum w-4 shrink-0 text-right text-[11px] ${place === 0 ? 'text-accent' : 'text-ink-dim'}`}>
                {place + 1}
              </span>
              <span
                aria-hidden
                className="h-6 w-0.5 shrink-0 rounded-full"
                style={{ backgroundColor: colorFor(standing.memberSlug) }}
              />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{standing.displayName}</span>

              <span className="hidden shrink-0 items-center gap-1 min-[480px]:flex">
                {standing.champions.slice(0, CHAMPIONS_SHOWN).map((champion) => (
                  <ChampionIcon
                    key={champion.championId}
                    championId={champion.championId}
                    championName={champion.games > 1 ? `${champion.championName} ×${champion.games}` : champion.championName}
                    staticData={staticData}
                    size={22}
                  />
                ))}
                {extra > 0 && <span className="tnum text-[11px] text-ink-dim">+{extra}</span>}
              </span>

              <span className="tnum hidden w-16 shrink-0 text-right text-[11.5px] text-ink-muted min-[380px]:block">
                {kda(standing.kills, standing.deaths, standing.assists)} <span className="text-ink-dim">KDA</span>
              </span>
              <span className="tnum w-14 shrink-0 text-right text-[11.5px] text-ink-muted">
                {standing.wins}W {standing.losses}L
              </span>
              <span
                className={`tnum w-12 shrink-0 text-right text-[12.5px] ${standing.winRate >= 50 ? 'text-win' : 'text-loss'}`}
              >
                {Math.round(standing.winRate)}%
              </span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
