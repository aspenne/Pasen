import { Link } from '@tanstack/react-router'

import { ChampionIcon } from '@/components/ChampionIcon'
import { ItemRow } from '@/components/ItemRow'
import { Reveal } from '@/components/Reveal'
import type { MatchDetail, MatchDetailSide, StaticData } from '@/lib/api'
import { kda, positionLabel } from '@/lib/format'
import type { QueueScope } from '@pasen/shared'

type MatchScoreboardProps = {
  detail: MatchDetail
  staticData?: StaticData
  groupSlug: string
  scope: QueueScope
}

/** Arena sides are duos and there are eight of them; the Rift has two of five. */
function sideLabel(side: MatchDetailSide, arena: boolean): string {
  if (arena) return side.placement ? `#${side.placement}` : 'Team'
  return side.id === 100 ? 'Blue side' : 'Red side'
}

export function MatchScoreboard({
  detail,
  staticData,
  groupSlug,
  scope,
}: MatchScoreboardProps) {
  const arena = detail.queueGroup === 'arena'

  return (
    <Reveal
      token={detail.matchId}
      className={arena ? 'grid gap-2 sm:grid-cols-2' : 'grid gap-2 lg:grid-cols-2'}
    >
      {detail.sides.map((side) => (
        <div key={side.id} className="min-w-0 rounded-[6px] border border-line bg-ground/50 p-3">
          <div className="mb-2 flex items-baseline justify-between text-[12px]">
            <span className={side.win ? 'text-win' : 'text-loss'}>
              {sideLabel(side, arena)}
            </span>
            <span className="tnum text-ink-dim">
              {side.kills} kills · {(side.goldEarned / 1000).toFixed(1)}k gold
            </span>
          </div>

          <div className="space-y-1.5">
            {side.players.map((player) => {
              const name = player.displayName ?? player.riotId ?? 'Unknown'
              return (
                <div key={player.puuid} className="flex items-center gap-2.5">
                  <ChampionIcon
                    championId={player.championId}
                    championName={player.championName}
                    staticData={staticData}
                    size={28}
                  />

                  <div className="min-w-0 flex-1">
                    {player.memberSlug ? (
                      <Link
                        to="/$group/players/$member"
                        params={{ group: groupSlug, member: player.memberSlug }}
                        search={{ scope }}
                        className="block truncate text-[13px] text-accent transition-colors hover:text-ink"
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="block truncate text-[13px] text-ink-muted">{name}</span>
                    )}
                    <span className="block truncate text-[11px] text-ink-dim">
                      {player.championName}
                      {positionLabel(player.teamPosition) &&
                        ` · ${positionLabel(player.teamPosition)}`}
                    </span>
                  </div>

                  <div className="hidden shrink-0 xl:block">
                    <ItemRow items={player.items} staticData={staticData} />
                  </div>

                  <div className="w-[84px] shrink-0 text-right sm:w-[92px]">
                    <div className="tnum text-[12px] text-ink">
                      {player.kills} / {player.deaths} / {player.assists}
                    </div>
                    <div className="tnum text-[11px] text-ink-dim">
                      {kda(player.kills, player.deaths, player.assists)} · {player.cs} cs
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </Reveal>
  )
}
