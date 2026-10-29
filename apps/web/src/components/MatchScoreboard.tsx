import { Link } from '@tanstack/react-router'

import { ChampionIcon } from '@/components/ChampionIcon'
import { ItemRow } from '@/components/ItemRow'
import { RunePageButton } from '@/components/RunePageButton'
import { Reveal } from '@/components/Reveal'
import type { MatchDetail, MatchDetailSide, StaticData } from '@/lib/api'
import { compactNumber, csLine, dpmUrl, kda, positionLabel } from '@/lib/format'
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
  // Bars are against the game's best, so the top damage dealer fills theirs.
  const topDamage = Math.max(1, ...detail.sides.flatMap((side) => side.players.map((player) => player.damageDealt)))

  return (
    <Reveal
      token={detail.matchId}
      className={arena ? 'grid gap-2 sm:grid-cols-2' : 'grid gap-2 @3xl:grid-cols-2'}
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
              // The tag is on dpm.lol a click away; on the row it only crowds the name out.
              const name = player.displayName ?? player.riotId?.split('#')[0] ?? 'Unknown'
              const dpm = dpmUrl(player.riotId)
              return (
                <div key={player.puuid} className="flex items-center gap-2">
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
                    <span className="flex items-center gap-1.5 text-[11px] text-ink-dim">
                      <span className="truncate">
                        {player.championName}
                        {positionLabel(player.teamPosition) &&
                          ` · ${positionLabel(player.teamPosition)}`}
                      </span>
                      {dpm && (
                        <a
                          href={dpm}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${name} on dpm.lol`}
                          className="shrink-0 rounded-[3px] border border-line px-1 text-[9.5px] uppercase tracking-[0.08em] text-ink-muted transition-colors hover:border-accent hover:text-accent"
                        >
                          dpm
                        </a>
                      )}
                    </span>
                  </div>

                  <RunePageButton perks={player.perks} staticData={staticData} name={name} />

                  {!arena && (
                    <div className="w-[46px] shrink-0" title={`${player.damageDealt.toLocaleString('en-GB')} damage to champions`}>
                      <div className="tnum text-right text-[11px] text-ink-muted">{compactNumber(player.damageDealt)}</div>
                      <div className="mt-1 h-1 overflow-hidden rounded-[2px] bg-line-strong">
                        <div
                          className={`h-full ${side.win ? 'bg-win' : 'bg-loss'}`}
                          style={{ width: `${Math.round((player.damageDealt / topDamage) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="hidden shrink-0 @4xl:block">
                    <ItemRow items={player.items} staticData={staticData} />
                  </div>

                  <div className="w-[84px] shrink-0 text-right">
                    <div className="tnum text-[12px] text-ink">
                      {player.kills} / {player.deaths} / {player.assists}
                    </div>
                    <div className="tnum text-[11px] text-ink-dim">
                      {kda(player.kills, player.deaths, player.assists)} KDA
                    </div>
                    <div className="tnum whitespace-nowrap text-[10.5px] text-ink-dim">
                      {csLine(player.cs, detail.gameDuration)}
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
