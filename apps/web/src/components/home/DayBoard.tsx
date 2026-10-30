import { Link } from '@tanstack/react-router'
import type { QueueScope } from '@pasen/shared'

import { ChampionIcon } from '@/components/ChampionIcon'
import type { StaticData } from '@/lib/api'
import type { DayStanding } from '@/lib/day'
import { kda } from '@/lib/format'
import { signed } from '@/lib/ladder'

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
    // minmax(0, 1fr): an auto column would grow to the longest name and push the win rate off a phone.
    <ol className="grid grid-cols-[minmax(0,1fr)] gap-px overflow-hidden rounded-[8px] border border-line bg-line">
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
              {standing.lp !== null && (
                <span
                  title="LP won or lost that day, refunded losses included"
                  className={`tnum w-[58px] shrink-0 text-right text-[11.5px] ${
                    standing.lp > 0 ? 'text-win' : standing.lp < 0 ? 'text-loss' : 'text-ink-dim'
                  }`}
                >
                  {signed(standing.lp)} LP
                </span>
              )}
              <span
                title={standing.remakes > 0 ? `${standing.remakes} remake${standing.remakes === 1 ? '' : 's'}, neither won nor lost` : undefined}
                className="tnum shrink-0 whitespace-nowrap text-right text-[11.5px] text-ink-muted min-w-14"
              >
                {standing.wins}W {standing.losses}L
                {standing.remakes > 0 && <span className="text-ink-dim"> {standing.remakes}R</span>}
              </span>
              <span
                className={`tnum w-12 shrink-0 text-right text-[12.5px] ${
                  standing.winRate === null ? 'text-ink-dim' : standing.winRate >= 50 ? 'text-win' : 'text-loss'
                }`}
              >
                {standing.winRate === null ? '–' : `${Math.round(standing.winRate)}%`}
              </span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
