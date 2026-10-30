import { Link } from '@tanstack/react-router'

import { ChampionIcon } from '@/components/ChampionIcon'
import { ItemRow } from '@/components/ItemRow'
import { RunePageButton } from '@/components/RunePageButton'
import { Reveal } from '@/components/Reveal'
import type { MatchDetail, MatchDetailSide, StaticData } from '@/lib/api'
import { compactNumber, dpmUrl, kda, positionLabel } from '@/lib/format'
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

/*
 * One grid for the header and every row, so the columns line up down the
 * team. On a phone the row keeps only the player and the score; runes, items
 * and damage go on a second line. Damage and CS get columns from a medium side
 * up, the items from a wide one.
 */
const RIFT_COLUMNS =
  'grid-cols-[minmax(0,1fr)_72px] @lg:grid-cols-[minmax(0,1fr)_72px_88px_64px] @2xl:grid-cols-[minmax(0,1fr)_72px_88px_64px_206px]'
const ARENA_COLUMNS =
  'grid-cols-[minmax(0,1fr)_72px] @lg:grid-cols-[minmax(0,1fr)_72px_64px] @2xl:grid-cols-[minmax(0,1fr)_72px_64px_206px]'

/**
 * The teams one above the other, each as wide as the card. Side by side, the
 * names were the only thing left to shrink and came out as a single letter.
 */
export function MatchScoreboard({
  detail,
  staticData,
  groupSlug,
  scope,
}: MatchScoreboardProps) {
  const arena = detail.queueGroup === 'arena'
  const columns = arena ? ARENA_COLUMNS : RIFT_COLUMNS
  const minutes = detail.gameDuration / 60
  // Bars are against the game's best, so the top damage dealer fills theirs.
  const topDamage = Math.max(1, ...detail.sides.flatMap((side) => side.players.map((player) => player.damageDealt)))

  return (
    <Reveal
      token={detail.matchId}
      // Arena duos are two rows each, short enough to pair up again on a wide card.
      className={arena ? 'grid gap-3 @3xl:grid-cols-2' : 'space-y-3'}
    >
      {detail.sides.map((side) => (
        <section key={side.id} className="@container min-w-0 rounded-[6px] border border-line bg-ground/50 px-3 pt-2.5 pb-1 @lg:px-4">
          <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
            <span className={side.win ? 'text-win' : 'text-loss'}>
              {sideLabel(side, arena)}
              {!arena && ` · ${side.win ? 'Victory' : 'Defeat'}`}
            </span>
            <span className="tnum text-ink-dim">
              {side.kills} kills · {(side.goldEarned / 1000).toFixed(1)}k gold
            </span>
          </div>

          <div className={`mt-2 hidden gap-x-3 pb-1.5 text-[10.5px] uppercase tracking-[0.12em] text-ink-dim @lg:grid ${columns}`}>
            <span>Player</span>
            <span className="text-right">KDA</span>
            {!arena && <span>Damage</span>}
            <span className="text-right">CS</span>
            <span className="hidden @2xl:block">Items</span>
          </div>

          <div className="mt-1.5 @lg:mt-0">
            {side.players.map((player) => {
              // The tag is on dpm.lol a click away; on the row it only crowds the name out.
              const name = player.displayName ?? player.riotId?.split('#')[0] ?? 'Unknown'
              const dpm = dpmUrl(player.riotId)
              const position = positionLabel(player.teamPosition)
              const runes = <RunePageButton perks={player.perks} staticData={staticData} name={name} />
              const damage = !arena && (
                <div title={`${player.damageDealt.toLocaleString('en-GB')} damage to champions`}>
                  <div className="tnum text-[11.5px] text-ink-muted">{compactNumber(player.damageDealt)}</div>
                  <div className="mt-1 h-1 overflow-hidden rounded-[2px] bg-line-strong">
                    <div
                      className={`h-full ${side.win ? 'bg-win' : 'bg-loss'}`}
                      style={{ width: `${Math.round((player.damageDealt / topDamage) * 100)}%` }}
                    />
                  </div>
                </div>
              )
              return (
                <div key={player.puuid} className={`grid items-center gap-x-3 gap-y-2 border-t border-line py-2.5 ${columns}`}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ChampionIcon
                      championId={player.championId}
                      championName={player.championName}
                      staticData={staticData}
                      size={32}
                    />
                    <div className="min-w-0">
                      {player.memberSlug ? (
                        <Link
                          to="/$group/players/$member"
                          params={{ group: groupSlug, member: player.memberSlug }}
                          search={{ scope }}
                          className="block truncate text-[13.5px] text-accent transition-colors hover:text-ink"
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="block truncate text-[13.5px] text-ink">{name}</span>
                      )}
                      <span className="flex items-center gap-1.5 text-[11px] text-ink-dim">
                        <span className="truncate">
                          {player.championName}
                          {position && ` · ${position}`}
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
                    <span className="ml-auto hidden shrink-0 @lg:block">{runes}</span>
                  </div>

                  <div className="text-right">
                    <div className="tnum text-[12.5px] whitespace-nowrap text-ink">
                      {player.kills} / {player.deaths} / {player.assists}
                    </div>
                    <div className="tnum text-[11px] text-ink-dim">
                      {kda(player.kills, player.deaths, player.assists)}
                    </div>
                    {/* The CS column only fits from a medium side up. */}
                    <div className="tnum text-[11px] text-ink-dim @lg:hidden">{player.cs} cs</div>
                  </div>

                  {damage && <div className="hidden @lg:block">{damage}</div>}

                  <div className="hidden text-right @lg:block">
                    <div className="tnum text-[12px] text-ink-muted">{player.cs}</div>
                    {minutes > 0 && (
                      <div className="tnum text-[11px] text-ink-dim">{(player.cs / minutes).toFixed(1)}/min</div>
                    )}
                  </div>

                  {/* Under the player on a narrow side, a column of its own on a wide one. */}
                  <div className="col-span-full flex items-center gap-2 @lg:pl-[42px] @2xl:col-span-1 @2xl:pl-0">
                    <span className="shrink-0 @lg:hidden">{runes}</span>
                    <ItemRow items={player.items} staticData={staticData} slotClassName="size-[22px] @lg:size-[26px]" />
                    {damage && <div className="min-w-0 flex-1 @lg:hidden">{damage}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </Reveal>
  )
}
