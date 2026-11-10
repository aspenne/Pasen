import { Link } from '@tanstack/react-router'
import type { QueueScope } from '@pasen/shared'
import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'

import { ChampionIcon } from '@/components/ChampionIcon'
import type { CustomGame, CustomTeam, StaticData } from '@/lib/api'
import { customResult, customTitle } from '@/lib/customs'
import { duration } from '@/lib/format'

/**
 * One custom in the list. Folded, it is the line it always was; unfolded, it
 * shows both teams - who played what, and how it went - without leaving the
 * page. The full scoreboard is a link away.
 */
export function CustomGameRow({
  game,
  group,
  scope,
  timezone,
  staticData,
}: {
  game: CustomGame
  group: string
  scope: QueueScope
  timezone: string
  staticData?: StaticData
}) {
  const [open, setOpen] = useState(false)
  const result = customResult(game)
  const humans = game.teams.flatMap((team) => team.players).filter((p) => !p.isBot)
  const panelId = `custom-${game.id}-teams`

  return (
    <li className="bg-panel">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-panel-raised"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="display truncate text-[17px] font-semibold text-ink">{customTitle(game)}</span>
            {game.againstBots && (
              <span className="shrink-0 rounded-[3px] border border-line-strong px-1 text-[10px] uppercase tracking-[0.1em] text-ink-dim">
                vs bots
              </span>
            )}
          </div>
          <div className="truncate text-[12px] text-ink-dim">
            {new Date(game.playedAt).toLocaleString('en-GB', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: timezone,
            })}
            {' · '}
            {duration(game.duration)}
            {humans.length > 0 && ` · ${humans.map((p) => p.displayName ?? p.name).join(', ')}`}
          </div>
        </div>

        <span className={`display text-[13px] font-semibold uppercase tracking-[0.08em] ${result.tone}`}>
          {result.text}
        </span>
        <ChevronDownIcon
          aria-hidden
          className={`size-4 shrink-0 text-ink-dim transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div id={panelId} className="@container space-y-3 border-t border-line px-4 py-3">
          <div className="grid gap-3 @2xl:grid-cols-2">
            {game.teams.map((team) => (
              <TeamList key={team.side} team={team} group={group} scope={scope} staticData={staticData} />
            ))}
          </div>
          <Link
            to="/$group/customs/$id"
            params={{ group, id: String(game.id) }}
            search={{ scope }}
            className="tap inline-flex items-center text-[12px] text-accent underline-offset-2 hover:underline"
          >
            Full scoreboard →
          </Link>
        </div>
      )}
    </li>
  )
}

function TeamList({
  team,
  group,
  scope,
  staticData,
}: {
  team: CustomTeam
  group: string
  scope: QueueScope
  staticData?: StaticData
}) {
  const blue = team.side === 'ORDER'
  return (
    <section aria-label={blue ? 'Blue side' : 'Red side'}>
      <h3 className="mb-1.5 flex items-baseline gap-2 text-[11px] uppercase tracking-[0.14em]">
        <span className={blue ? 'text-[#4f8cff]' : 'text-[#ff5a4a]'}>{blue ? 'Blue side' : 'Red side'}</span>
        {team.won !== null && (
          <span className={team.won ? 'text-win' : 'text-loss'}>{team.won ? 'Victory' : 'Defeat'}</span>
        )}
        <span className="tnum ml-auto normal-case tracking-normal text-ink-dim">{team.kills} kills</span>
      </h3>
      <ul className="space-y-1">
        {team.players.map((player) => (
          <li key={player.riotId} className="flex items-center gap-2.5">
            <ChampionIcon
              championId={player.championId}
              championName={player.championName}
              staticData={staticData}
              size={28}
            />
            <span className="min-w-0 flex-1 truncate text-[13px]">
              {player.memberSlug ? (
                <Link
                  to="/$group/players/$member"
                  params={{ group, member: player.memberSlug }}
                  search={{ scope }}
                  className="text-ink underline-offset-2 hover:underline"
                >
                  {player.displayName ?? player.name}
                </Link>
              ) : (
                <span className={player.isBot ? 'text-ink-dim' : 'text-ink'}>
                  {player.displayName ?? player.name}
                  {player.isBot && ' (bot)'}
                </span>
              )}
              <span className="ml-1.5 text-[11px] text-ink-dim">{player.championName}</span>
            </span>
            <span className="tnum shrink-0 text-[12px] text-ink-muted">
              {player.kills}/{player.deaths}/{player.assists}
            </span>
            <span className="tnum hidden w-14 shrink-0 text-right text-[11px] text-ink-dim min-[420px]:block">
              {player.cs} cs
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
