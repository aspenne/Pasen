import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { ChampionIcon } from '@/components/ChampionIcon'
import { SortableHead } from '@/components/SortableHead'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { useSort } from '@/hooks/useSort'
import type { CustomDashboard as Dashboard, CustomIdentity, StaticData } from '@/lib/api'
import { duration } from '@/lib/format'
import type { QueueScope } from '@pasen/shared'
import { CUSTOM_SCOPE } from '@/lib/customs'

type Props = {
  data: Dashboard
  staticData?: StaticData
  groupSlug: string
  scope: QueueScope
}

const RECORD_LABELS = {
  kills: 'Most kills in a game',
  assists: 'Most assists in a game',
  deaths: 'Most deaths in a game',
  cs: 'Most CS in a game',
} as const

const MULTIKILLS: Record<number, string> = { 2: 'Double', 3: 'Triple', 4: 'Quadra', 5: 'Penta' }

/** Small caps heading, the same voice as every other section label on the site. */
function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 className="text-[11px] uppercase tracking-[0.15em] text-ink-dim">{children}</h2>
      {aside && <span className="text-[11px] text-ink-dim">{aside}</span>}
    </div>
  )
}

/** A member links to their page; a friend off the roster is just a name. */
function Who({
  who,
  groupSlug,
  className = '',
}: {
  who: CustomIdentity
  groupSlug: string
  className?: string
}) {
  if (!who.memberSlug) return <span className={`text-ink-muted ${className}`}>{who.name}</span>
  return (
    <Link
      to="/$group/players/$member"
      params={{ group: groupSlug, member: who.memberSlug }}
      // A player opened from the customs opens on their customs.
      search={{ scope: CUSTOM_SCOPE }}
      className={`text-ink transition-colors hover:text-accent ${className}`}
    >
      {who.name}
    </Link>
  )
}

/**
 * Stats across every inhouse - only what a Live Client capture carries, since
 * the client reports no gold or damage for the other nine players.
 *
 * Practice against bots is left out of all of it, and anything about winning
 * counts only the games with a known result; the header says how many of each
 * went in, so a thin number reads as a small sample rather than as a verdict.
 */
export function CustomDashboard({ data, staticData, groupSlug, scope }: Props) {
  const { sorted, key, direction, toggle } = useSort(data.players, 'games')

  if (data.counted === 0) {
    return (
      <section>
        <SectionTitle>Inhouse stats</SectionTitle>
        <p className="bg-panel px-4 py-3 text-[13px] text-ink-muted">
          Stats start with the first custom that has at least two of you in it. Practice against
          bots is not counted.
        </p>
      </section>
    )
  }

  const decided = data.overview.blueWins + data.overview.redWins

  return (
    <div className="space-y-7">
      {/* ---- the overview ---- */}
      <section>
        <SectionTitle
          aside={
            data.resolved < data.counted
              ? `${data.counted - data.resolved} without a result: counted for performance, not for wins`
              : undefined
          }
        >
          Inhouse stats
        </SectionTitle>
        <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
          {[
            ['Inhouses', String(data.counted)],
            ['Kills', data.overview.kills.toLocaleString('en-GB')],
            ['Average length', duration(data.overview.averageDuration)],
            ['Blue – red', decided > 0 ? `${data.overview.blueWins} – ${data.overview.redWins}` : '—'],
          ].map(([label, value]) => (
            <div key={label} className="bg-panel px-4 py-3">
              <dt className="text-[11px] text-ink-dim">{label}</dt>
              <dd className="display tnum mt-0.5 text-[26px] font-bold leading-none text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---- single-game records ---- */}
      {data.records.length > 0 && (
        <section>
          <SectionTitle>Records</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.records.map((record) => (
              <div key={record.kind} className="flex min-w-0 items-center gap-3 bg-panel px-4 py-3">
                <ChampionIcon
                  championId={record.championId}
                  championName={record.championName}
                  staticData={staticData}
                  size={44}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-ink-dim">{RECORD_LABELS[record.kind]}</div>
                  <div className="truncate text-[14px]">
                    <Who who={record} groupSlug={groupSlug} className="display font-semibold" />
                    <span className="text-ink-dim"> on {record.championName}</span>
                  </div>
                  <Link
                    to="/$group/customs/$id"
                    params={{ group: groupSlug, id: String(record.gameId) }}
                    search={{ scope }}
                    className="truncate text-[11px] text-ink-dim transition-colors hover:text-ink"
                  >
                    {record.gameLabel ?? 'See the game'} →
                  </Link>
                </div>
                <div className="display tnum shrink-0 text-[34px] font-extrabold leading-none text-ink">
                  {record.value}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- per player ---- */}
      <section>
        <SectionTitle aside="Sort by any column">Players</SectionTitle>
        <div className="bg-panel">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="border-line hover:bg-transparent">
                <SortableHead column="name" activeKey={key} direction={direction} onSort={toggle}>
                  Player
                </SortableHead>
                {(
                  [
                    ['games', 'Games'],
                    ['kda', 'KDA'],
                    ['killsPerGame', 'K / game'],
                    ['deathsPerGame', 'D / game'],
                    ['assistsPerGame', 'A / game'],
                    ['csPerMinute', 'CS / min'],
                    ['visionPerGame', 'Vision'],
                    ['firstBloods', 'First bloods'],
                    ['bestMultikill', 'Best'],
                  ] as const
                ).map(([column, label]) => (
                  <SortableHead
                    key={column}
                    column={column}
                    activeKey={key}
                    direction={direction}
                    onSort={toggle}
                    align="right"
                  >
                    {label}
                  </SortableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((line) => (
                <TableRow key={line.key} className="border-line">
                  <TableCell className="max-w-[180px] truncate">
                    <Who who={line} groupSlug={groupSlug} className="display text-[14px] font-semibold" />
                  </TableCell>
                  <TableCell className="tnum text-right text-ink-muted">{line.games}</TableCell>
                  <TableCell className="tnum text-right font-semibold text-ink">{line.kda}</TableCell>
                  <TableCell className="tnum text-right">{line.killsPerGame}</TableCell>
                  <TableCell className="tnum text-right">{line.deathsPerGame}</TableCell>
                  <TableCell className="tnum text-right">{line.assistsPerGame}</TableCell>
                  <TableCell className="tnum text-right">{line.csPerMinute}</TableCell>
                  <TableCell className="tnum text-right">{line.visionPerGame}</TableCell>
                  <TableCell className="tnum text-right">{line.firstBloods || '—'}</TableCell>
                  <TableCell className="text-right text-[12px] text-ink-muted">
                    {MULTIKILLS[line.bestMultikill] ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="grid gap-7 lg:grid-cols-2">
        {/* ---- champions ---- */}
        <section className="min-w-0">
          <SectionTitle aside="Picked twice at least">Most picked</SectionTitle>
          {data.champions.length === 0 ? (
            <p className="bg-panel px-4 py-3 text-[13px] text-ink-muted">
              No champion has been picked twice yet.
            </p>
          ) : (
            <ul className="divide-y divide-line bg-panel">
              {data.champions.map((champion) => (
                <li key={champion.championId} className="flex items-center gap-3 px-4 py-2">
                  <ChampionIcon
                    championId={champion.championId}
                    championName={champion.championName}
                    staticData={staticData}
                    size={30}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="display truncate text-[14px] font-semibold text-ink">
                      {champion.championName}
                    </div>
                    <div className="text-[11px] text-ink-dim">
                      by {champion.players} {champion.players === 1 ? 'player' : 'players'}
                    </div>
                  </div>
                  <div className="tnum text-right">
                    <div className="text-[13px] text-ink">
                      {champion.games} {champion.games === 1 ? 'game' : 'games'}
                    </div>
                    {champion.winRate !== null && (
                      <div className={`text-[11px] ${champion.winRate >= 50 ? 'text-win' : 'text-loss'}`}>
                        {champion.winRate}%
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- duos ---- */}
        <section className="min-w-0">
          <SectionTitle aside="Two games together at least">Best duos</SectionTitle>
          {data.duos.length === 0 ? (
            <p className="bg-panel px-4 py-3 text-[13px] text-ink-muted">
              No pair has played two inhouses on the same side yet.
            </p>
          ) : (
            <ul className="divide-y divide-line bg-panel">
              {data.duos.map((duo) => (
                <li key={`${duo.a.key}|${duo.b.key}`} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1 truncate text-[14px]">
                    <Who who={duo.a} groupSlug={groupSlug} className="display font-semibold" />
                    <span className="text-ink-dim"> + </span>
                    <Who who={duo.b} groupSlug={groupSlug} className="display font-semibold" />
                  </div>
                  <div className="tnum shrink-0 text-right">
                    <div className="text-[13px] text-ink">
                      {duo.wins}–{duo.games - duo.wins}
                    </div>
                    <div className={`text-[11px] ${duo.winRate >= 50 ? 'text-win' : 'text-loss'}`}>
                      {duo.winRate}%
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
