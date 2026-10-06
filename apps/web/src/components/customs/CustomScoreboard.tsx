import { Link } from '@tanstack/react-router'

import { ChampionIcon } from '@/components/ChampionIcon'
import { ItemRow } from '@/components/ItemRow'
import { RunePair } from '@/components/RunePair'
import type { CustomTeam, StaticData } from '@/lib/api'
import { kda, positionLabel } from '@/lib/format'
import type { QueueScope } from '@pasen/shared'

const SIDE_NAMES = { ORDER: 'Blue side', CHAOS: 'Red side' } as const

/** Only the ones worth pointing at: a double kill is a Tuesday. */
const MULTIKILLS: Record<number, string> = { 3: 'Triple', 4: 'Quadra', 5: 'Penta' }

const OBJECTIVES = [
  ['turrets', 'turrets'],
  ['inhibitors', 'inhibitors'],
  ['dragons', 'dragons'],
  ['grubs', 'grubs'],
  ['heralds', 'heralds'],
  ['barons', 'barons'],
] as const

/**
 * One side of a captured custom.
 *
 * Deliberately not the match scoreboard with blanks in it: a Live Client
 * capture has no gold and no damage, and a column of zeros would state
 * something false. What it does carry - level, ward score, the best multikill -
 * takes their place.
 */
export function CustomScoreboard({
  team,
  staticData,
  groupSlug,
  scope,
}: {
  team: CustomTeam
  staticData?: StaticData
  groupSlug: string
  scope: QueueScope
}) {
  const verdict =
    team.won === null ? null : team.won ? (
      <span className="cut-plate display bg-win/15 px-3 py-0.5 text-[12px] font-bold uppercase tracking-[0.14em] text-win">
        Victory
      </span>
    ) : (
      <span className="cut-plate display bg-loss/15 px-3 py-0.5 text-[12px] font-bold uppercase tracking-[0.14em] text-loss">
        Defeat
      </span>
    )

  const taken = OBJECTIVES.filter(([key]) => team.objectives[key] > 0)

  return (
    <section
      className={`min-w-0 border-l-[3px] bg-panel ${
        team.won === null ? 'border-l-line-strong' : team.won ? 'border-l-win' : 'border-l-loss'
      }`}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pt-3.5 pb-2.5">
        <h2 className="display text-[17px] font-bold uppercase tracking-[0.06em] text-ink">
          {SIDE_NAMES[team.side]}
        </h2>
        {verdict}
        <span className="display tnum ml-auto text-[22px] font-bold text-ink">
          {team.kills}
          <span className="ml-1 font-sans text-[11px] font-normal text-ink-dim">kills</span>
        </span>
      </header>

      {taken.length > 0 && (
        <p className="tnum flex flex-wrap gap-x-3 px-4 pb-2.5 text-[11px] text-ink-dim">
          {taken.map(([key, label]) => (
            <span key={key}>
              <span className="text-ink-muted">{team.objectives[key]}</span> {label}
            </span>
          ))}
        </p>
      )}

      <ul className="divide-y divide-line border-t border-line">
        {team.players.map((player) => {
          const multikill = MULTIKILLS[player.bestMultikill]
          return (
            <li
              key={`${player.riotId}-${player.championName}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5"
            >
              <ChampionIcon
                championId={player.championId}
                championName={player.championName}
                staticData={staticData}
                size={34}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  {player.memberSlug ? (
                    <Link
                      to="/$group/players/$member"
                      params={{ group: groupSlug, member: player.memberSlug }}
                      search={{ scope }}
                      className="display truncate text-[15px] font-semibold text-ink transition-colors hover:text-accent"
                    >
                      {player.displayName ?? player.name}
                    </Link>
                  ) : (
                    <span
                      className={`display truncate text-[15px] font-semibold ${
                        player.isBot ? 'text-ink-dim' : 'text-ink-muted'
                      }`}
                    >
                      {player.isBot ? player.championName : player.name}
                    </span>
                  )}
                  {player.isBot && (
                    <span className="shrink-0 rounded-[3px] border border-line-strong px-1 text-[10px] uppercase tracking-[0.1em] text-ink-dim">
                      Bot
                    </span>
                  )}
                  {multikill && (
                    <span className="cut-plate display shrink-0 bg-accent px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-on-accent">
                      {multikill}
                    </span>
                  )}
                </div>
                <div className="truncate text-[11px] text-ink-dim">
                  {player.isBot ? 'Bot' : player.championName}
                  {positionLabel(player.position) && ` · ${positionLabel(player.position)}`}
                  {` · level ${player.level}`}
                </div>
              </div>

              <RunePair perks={player.perks} staticData={staticData} size={20} />

              <div className="hidden shrink-0 xl:block">
                <ItemRow items={player.items} staticData={staticData} />
              </div>

              <div className="w-[96px] shrink-0 text-right">
                <div className="display tnum text-[15px] font-bold text-ink">
                  {player.kills} / {player.deaths} / {player.assists}
                </div>
                <div className="tnum text-[11px] text-ink-dim">
                  {kda(player.kills, player.deaths, player.assists)} · {player.cs} cs
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
