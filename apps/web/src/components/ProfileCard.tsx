import { useRef, type CSSProperties } from 'react'

import { ChampionIcon } from '@/components/ChampionIcon'
import type {
  ChampionPool,
  LadderStanding,
  MemberRank,
  ProfileCardStats,
  StaticData,
} from '@/lib/api'
import { championSplash } from '@/lib/ddragon'
import { positionLabel, rankLabel, tierColor, tierCrest } from '@/lib/format'
import { prefersReducedMotion } from '@/lib/motion'
import { PLATFORM_SHORT, type Platform } from '@pasen/shared'

type ProfileCardProps = {
  /** Sizing from the page: the card fills whatever height it is given. */
  className?: string
  name: string
  tagLine: string | null
  rank: MemberRank | null
  ladder?: LadderStanding
  /** Peak league points across the snapshots we hold, null before the first. */
  peakLp: number | null
  totals: { games: number; wins: number; winRate: number; kda: number; csPerMinute: number }
  card: ProfileCardStats
  pool?: ChampionPool
  staticData?: StaticData
}

const MULTIKILL_LABEL = {
  penta: 'Pentakills',
  quadra: 'Quadrakills',
  triple: 'Triple kills',
  double: 'Double kills',
} as const

/**
 * A self-contained recap of a player's season, built to be looked at rather
 * than read: a collectible rather than a panel. It restates the headline rank on
 * purpose - a card that needed the rest of the page to make sense would not be
 * one.
 *
 * The foil is a single specular bar in the tier's colour over a brushed
 * surface, with a prismatic rim that lights along whichever edge the card is
 * tilted towards. Pointer position drives both through two custom properties,
 * so the whole effect is CSS and the component only writes numbers.
 */
export function ProfileCard({
  className = '',
  name,
  tagLine,
  rank,
  ladder,
  peakLp,
  totals,
  card,
  pool,
  staticData,
}: ProfileCardProps) {
  const frame = useRef<HTMLElement>(null)
  const art = useRef<HTMLDivElement>(null)

  const crest = tierCrest(rank?.tier)
  const mostPlayed = pool?.entries[0]
  const splash = championSplash(
    staticData?.champions[String(mostPlayed?.championId ?? '')]?.slug
  )

  const move = (clientX: number, clientY: number) => {
    const node = frame.current
    if (!node || prefersReducedMotion()) return

    const box = node.getBoundingClientRect()
    const px = Math.min(100, Math.max(0, ((clientX - box.left) / box.width) * 100))
    const py = Math.min(100, Math.max(0, ((clientY - box.top) / box.height) * 100))

    node.style.setProperty('--rim', '1')
    node.style.setProperty('--px', px.toFixed(1))
    node.style.setProperty('--py', py.toFixed(1))
    // Lean into the light rather than away from it.
    node.style.setProperty('--ry', `${(((px - 50) / 50) * 8).toFixed(2)}deg`)
    node.style.setProperty('--rx', `${(((50 - py) / 50) * 8).toFixed(2)}deg`)
    // The art travels further than the frame, which is what reads as depth.
    if (art.current) {
      art.current.style.transform = `translate3d(${(((50 - px) / 50) * 9).toFixed(1)}px, ${(
        ((50 - py) / 50) *
        9
      ).toFixed(1)}px, 0)`
    }
  }

  const rest = () => {
    const node = frame.current
    if (!node) return
    node.removeAttribute('data-active')
    node.style.removeProperty('--rim')
    node.style.removeProperty('--rx')
    node.style.removeProperty('--ry')
    if (art.current) art.current.style.transform = ''
  }

  const activate = () => frame.current?.setAttribute('data-active', '')

  return (
    <article
      ref={frame}
      tabIndex={0}
      className={`player-card ${className}`}
      style={{ '--tier': tierColor(rank?.tier) } as CSSProperties}
      onPointerEnter={activate}
      onPointerMove={(event) => move(event.clientX, event.clientY)}
      onPointerLeave={rest}
      onPointerCancel={rest}
      onFocus={() => {
        activate()
        const box = frame.current?.getBoundingClientRect()
        if (box) move(box.left + box.width * 0.34, box.top + box.height * 0.3)
      }}
      onBlur={rest}
      aria-label={`${name} season card`}
    >
      <div className="player-card-art">
        <div
          ref={art}
          className="player-card-art-img"
          style={splash ? { backgroundImage: `url(${splash})` } : undefined}
        />
      </div>
      <div className="player-card-sheen" />
      <div className="player-card-rim" />

      <div className="relative z-[3] flex h-full flex-col justify-end gap-3 p-4">
        <header className="flex items-center gap-2.5">
          {crest && <img src={crest} alt="" aria-hidden width={34} height={34} className="shrink-0" />}
          <div className="min-w-0">
            <h3 className="display truncate text-[19px] font-semibold leading-tight">
              {name} {tagLine && <span className="text-[13px] text-ink-dim">#{tagLine}</span>}
            </h3>
            <p className="truncate text-[12px]" style={{ color: tierColor(rank?.tier) }}>
              {rank ? rankLabel(rank) : 'Unranked'}
            </p>
          </div>
          {ladder?.position && (
            <div className="ml-auto shrink-0 text-right">
              <div className="display tnum text-[14px] font-semibold">
                #{ladder.position.toLocaleString('en-GB')}
              </div>
              <div className="text-[10px] tracking-[0.14em] text-ink-dim">
                {PLATFORM_SHORT[ladder.platform as Platform] ?? ladder.platform}
              </div>
            </div>
          )}
        </header>

        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-[6px] border border-line bg-line">
          <Cell label="Games" value={totals.games} note={`${totals.wins}W ${totals.games - totals.wins}L`} />
          <Cell
            label="Win rate"
            value={`${totals.winRate}%`}
            note="ranked solo"
            tone={totals.winRate >= 50 ? 'win' : 'loss'}
          />
          <Cell
            label="Peak"
            value={peakLp === null ? '—' : `${peakLp} LP`}
            note="since tracked"
          />
          <Cell
            label="KDA"
            value={totals.kda.toFixed(2)}
            note={card.killParticipation === null ? undefined : `${card.killParticipation}% KP`}
          />
          <Cell
            label="CS / min"
            value={totals.csPerMinute.toFixed(1)}
            note={`${card.hoursPlayed}h played`}
          />
          <Cell label="Best run" value={`${card.bestStreak}W`} note="in a row" />
        </dl>

        <div className="flex items-center gap-2 text-[11px] text-ink-muted">
          {card.mainRole && (
            <span className="rounded-[4px] border border-line-strong px-1.5 py-0.5 text-[11px] tracking-[0.08em] text-ink">
              {positionLabel(card.mainRole) ?? card.mainRole}
            </span>
          )}
          {card.roleShare !== null && <span>{card.roleShare}% of games</span>}
          {card.bestMultikill && (
            <>
              <span aria-hidden className="size-[3px] rounded-full bg-ink-dim" />
              <span>
                {card.bestMultikill.count} {MULTIKILL_LABEL[card.bestMultikill.kind].toLowerCase()}
              </span>
            </>
          )}
        </div>

        <footer className="grid grid-cols-2 gap-2">
          {mostPlayed && (
            <Champion
              label="Most played"
              championId={mostPlayed.championId}
              championName={mostPlayed.championName}
              detail={`${mostPlayed.games}g · ${mostPlayed.winRate}%`}
              staticData={staticData}
            />
          )}
          {card.bestChampion && (
            <Champion
              label="Best win rate"
              championId={
                pool?.entries.find((e) => e.championName === card.bestChampion?.championName)
                  ?.championId ?? 0
              }
              championName={card.bestChampion.championName}
              detail={`${card.bestChampion.games}g · ${card.bestChampion.winRate}%`}
              staticData={staticData}
            />
          )}
        </footer>
      </div>
    </article>
  )
}

function Cell({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: string | number
  note?: string
  tone?: 'win' | 'loss'
}) {
  return (
    <div className="bg-ground/80 px-2.5 py-2">
      <dt className="text-[9px] uppercase tracking-[0.13em] text-ink-dim">{label}</dt>
      <dd
        className={`display mt-1.5 text-[16px] font-semibold leading-none ${
          tone === 'win' ? 'text-win' : tone === 'loss' ? 'text-loss' : ''
        }`}
      >
        {value}
      </dd>
      {note && <div className="mt-1 text-[10px] text-ink-dim">{note}</div>}
    </div>
  )
}

function Champion({
  label,
  championId,
  championName,
  detail,
  staticData,
}: {
  label: string
  championId: number
  championName: string
  detail: string
  staticData?: StaticData
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <ChampionIcon
        championId={championId}
        championName={championName}
        staticData={staticData}
        size={30}
      />
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-[0.12em] text-ink-dim">{label}</div>
        <div className="mt-0.5 truncate text-[11px] text-ink-muted">
          {championName} · {detail}
        </div>
      </div>
    </div>
  )
}
