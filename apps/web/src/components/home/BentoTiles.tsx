import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { QueueScope } from '@pasen/shared'

import { ChampionIcon } from '@/components/ChampionIcon'
import type { ActivityDay, CustomGame, DuoPair, FearlessBoard, GroupChampion, LesBoard, StaticData } from '@/lib/api'
import { customResult, customTitle } from '@/lib/customs'
import { signed } from '@/lib/ladder'
import { countdownLabel } from '@/lib/les'

/** One cell of the home grid. `span` is how many of its columns it takes. */
export function Tile({
  span = 1,
  title,
  aside,
  children,
}: {
  span?: 1 | 2 | 4
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  const width = span === 4 ? 'col-span-full' : span === 2 ? 'col-span-full @[640px]:col-span-2' : 'col-span-1'
  return (
    <section className={`${width} min-w-0 rounded-[10px] border border-line bg-panel px-4 py-3.5`}>
      <h2 className="mb-2.5 flex items-baseline justify-between gap-3 text-[10.5px] uppercase tracking-[0.15em] text-ink-dim">
        <span>{title}</span>
        {aside && <span className="tnum normal-case tracking-normal">{aside}</span>}
      </h2>
      {children}
    </section>
  )
}

/** The LAN countdown and the two teams' score, until the LAN. */
export function LesTile({ board, group, scope }: { board: LesBoard; group: string; scope: QueueScope }) {
  const leader = board.entries.find((entry) => entry.games > 0)
  return (
    <Tile span={2} title={`Road to ${board.event.name}`} aside={countdownLabel(board.event.endsAt)}>
      <Link to="/$group/les" params={{ group }} search={{ scope }} className="block space-y-1 hover:opacity-90">
        {board.teams.map((team) => (
          <div key={team.key} className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="truncate text-ink">{team.name}</span>
            <b className={`tnum shrink-0 font-semibold ${team.lpGained >= 0 ? 'text-win' : 'text-loss'}`}>
              {signed(team.lpGained)} LP
            </b>
          </div>
        ))}
        <p className="pt-1 text-[12px] text-ink-dim">
          {leader ? `Leading: ${leader.displayName} ${signed(leader.lpGained)} LP` : 'Nobody has played yet'} →
        </p>
      </Link>
    </Tile>
  )
}

/** A fearless night when one runs, else the last custom and the way to the drafter. */
export function FearlessTile({
  board,
  lastCustom,
  group,
  scope,
}: {
  board: FearlessBoard | null | undefined
  lastCustom: CustomGame | undefined
  group: string
  scope: QueueScope
}) {
  const active = board?.night.active
  const result = lastCustom ? customResult(lastCustom) : null
  return (
    <Tile span={2} title={active ? 'Fearless night' : 'Customs'} aside={active ? 'in progress' : undefined}>
      {active ? (
        <Link to="/$group/fearless" params={{ group }} search={{ scope }} className="block hover:opacity-90">
          <div className="display text-[18px] font-semibold uppercase tracking-[0.04em] text-ink">
            {board.night.label ?? 'Fearless night'}
          </div>
          <p className="tnum mt-1 text-[12px] text-ink-muted">
            {board.burned.length} burned · {board.games.length} {board.games.length === 1 ? 'game' : 'games'} · see what is free →
          </p>
        </Link>
      ) : lastCustom && result ? (
        <Link
          to="/$group/customs/$id"
          params={{ group, id: String(lastCustom.id) }}
          search={{ scope }}
          className="block hover:opacity-90"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="display truncate text-[16px] font-semibold text-ink">{customTitle(lastCustom)}</span>
            <span className={`display shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] ${result.tone}`}>
              {result.text}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-ink-dim">Last custom · all customs →</p>
        </Link>
      ) : (
        <p className="text-[13px] text-ink-muted">No custom captured yet.</p>
      )}
      <div className="mt-2.5 flex gap-3 text-[12px]">
        <Link to="/$group/fearless" params={{ group }} search={{ scope }} className="tap inline-flex items-center text-ink-muted hover:text-ink">
          Fearless
        </Link>
        <Link to="/$group/draft" params={{ group }} search={{ scope }} className="tap inline-flex items-center text-accent hover:text-ink">
          Draft →
        </Link>
      </div>
    </Tile>
  )
}

/** A single figure, big. */
export function KpiTile({ title, value, detail, tone }: { title: string; value: ReactNode; detail: string; tone?: string }) {
  return (
    <Tile title={title}>
      <div className={`display tnum text-[30px] font-bold leading-none ${tone ?? 'text-ink'}`}>{value}</div>
      <p className="mt-1.5 text-[12px] text-ink-dim">{detail}</p>
    </Tile>
  )
}

/** The last seven days, a bar each, the won share filled in. */
export function WeekRhythmTile({ days }: { days: ActivityDay[] }) {
  const week = days.slice(-7)
  if (week.length === 0) return null
  const peak = Math.max(...week.map((day) => day.games), 1)
  const total = week.reduce((sum, day) => sum + day.games, 0)
  const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'narrow' })

  return (
    <Tile span={2} title="Last 7 days" aside={`${total} ${total === 1 ? 'game' : 'games'}`}>
      <div className="flex h-[64px] items-end gap-1.5" role="img" aria-label={`Games per day over the last 7 days, ${total} in all`}>
        {week.map((day) => (
          <span
            key={day.date}
            title={`${day.date} · ${day.games} games, ${day.wins} won`}
            className="relative flex-1 overflow-hidden rounded-t-[3px] bg-line-strong"
            style={{ height: `${Math.max(5, Math.round((day.games / peak) * 100))}%` }}
          >
            <span
              className="absolute inset-x-0 bottom-0 bg-accent"
              style={{ height: `${day.games ? Math.round((day.wins / day.games) * 100) : 0}%` }}
            />
          </span>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 text-center text-[10px] text-ink-dim">
        {week.map((day) => (
          <span key={day.date} className="flex-1">
            {weekday(day.date)}
          </span>
        ))}
      </div>
    </Tile>
  )
}

/** The pair that plays together most, against the two of them apart. */
export function DuoTile({ pair, nameOf, group, scope }: { pair: DuoPair; nameOf: (slug: string) => string; group: string; scope: QueueScope }) {
  return (
    <Tile span={2} title="Duo of the season" aside={`${pair.games} games`}>
      <Link to="/$group/insights" params={{ group }} search={{ scope }} className="block hover:opacity-90">
        <div className="display truncate text-[20px] font-bold text-ink">
          {nameOf(pair.a)} <span className="text-[14px] text-ink-dim">+</span> {nameOf(pair.b)}
        </div>
        <p className="tnum mt-1 text-[13px] text-ink-muted">
          <b className={pair.winRate >= 50 ? 'text-win' : 'text-loss'}>{pair.winRate}%</b> together ·{' '}
          {pair.soloWinRateA}% / {pair.soloWinRateB}% apart
        </p>
      </Link>
    </Tile>
  )
}

/** The group's most played champions, and who owns each. */
export function SignatureTile({
  champions,
  group,
  scope,
  staticData,
  span = 2,
}: {
  champions: GroupChampion[]
  group: string
  scope: QueueScope
  staticData?: StaticData
  /** The whole row when it has nothing beside it. */
  span?: 2 | 4
}) {
  return (
    <Tile span={span} title="Signature champions">
      <Link to="/$group/insights" params={{ group }} search={{ scope }} className="grid grid-cols-4 gap-2 hover:opacity-90">
        {champions.slice(0, 4).map((champion) => (
          <span key={champion.championId} className="flex min-w-0 flex-col items-center gap-1 text-center">
            <ChampionIcon championId={champion.championId} championName={champion.championName} staticData={staticData} size={40} />
            <span className="w-full truncate text-[11.5px] text-ink">{champion.players[0]?.displayName ?? champion.championName}</span>
            <span className="tnum text-[10.5px] text-ink-dim">
              {champion.games}g · {champion.winRate}%
            </span>
          </span>
        ))}
      </Link>
    </Tile>
  )
}
