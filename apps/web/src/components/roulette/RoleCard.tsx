import type { CSSProperties } from 'react'

import type { RouletteCard, RouletteSeat, RouletteSide, StaticData } from '@/lib/api'
import { championCentered } from '@/lib/ddragon'
import { rankLabel, tierColor } from '@/lib/format'
import { ROLES, roleIcon } from '@/lib/roulette'

/** The two sides keep League's own colours here, the one place the site uses them. */
const SIDE_COLOR: Record<RouletteSide, string> = { blue: '#4f8cff', red: '#ff5a4a' }

type Role = (typeof ROLES)[number]

/**
 * One player of the lobby, face down until their role is drawn, then turned
 * over: a compact version of their profile card - most played champion's
 * art, rank, two numbers - under a large badge with the role they drew.
 */
export function RoleCard({
  side,
  seat,
  card,
  role,
  revealed,
  staticData,
}: {
  side: RouletteSide
  /** Null when nobody in this team drew the lane. */
  seat: RouletteSeat | null
  card?: RouletteCard
  role: Role | null
  revealed: boolean
  /** For a bot's champion name. */
  staticData?: StaticData
}) {
  const botChampion = seat?.bot && seat.championId ? staticData?.champions[String(seat.championId)]?.name : undefined
  const name = card?.displayName ?? (botChampion ? `${botChampion} bot` : (seat?.name.split('#')[0] ?? ''))
  const tag = card?.tag ?? (seat?.bot ? null : (seat?.name.split('#')[1] ?? null))
  const championId = card?.championId ?? (seat?.bot ? seat.championId : null)
  const art = championId ? championCentered(championId) : null
  const border = card ? tierColor(card.tier) : 'var(--color-line-strong)'

  if (!seat) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-line-strong text-ink-dim">
        {role && <img src={roleIcon(role.icon)} alt="" width={32} height={32} className="opacity-40" />}
        <span className="text-[12px]">No player</span>
      </div>
    )
  }

  return (
    <div
      className="roulette-slot h-full"
      data-revealed={revealed}
      style={{ '--side': SIDE_COLOR[side] } as CSSProperties}
      aria-label={revealed && role ? `${name}, ${role.label}` : `${name}, role not revealed yet`}
    >
      <div className="roulette-card">
        <div className="roulette-face flex flex-col items-center justify-center gap-2.5 border border-line-strong bg-panel">
          <span className="display text-[14px] font-bold tracking-[0.3em] text-accent">PASEN</span>
          <span className="display flex size-12 items-center justify-center rounded-full border border-dashed border-line-strong text-[22px] text-ink-dim">
            ?
          </span>
          <span className="px-2 text-center text-[12px] text-ink-muted">{name}</span>
        </div>

        <div className="roulette-face roulette-front border bg-panel" style={{ borderColor: border }}>
          {art && (
            <img src={art} alt="" className="absolute inset-0 size-full object-cover object-[center_22%]" loading="lazy" />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgb(7 12 23 / 0.15) 0%, rgb(7 12 23 / 0) 35%, rgb(7 12 23 / 0.82) 66%, rgb(7 12 23 / 0.97) 100%)',
            }}
          />

          {role && (
            <div className="absolute inset-x-0 top-2.5 flex flex-col items-center">
              <span
                className="roulette-badge flex size-16 items-center justify-center rounded-full border-2 bg-ground/80"
                style={{ borderColor: 'var(--side)' }}
              >
                <img src={roleIcon(role.icon)} alt={role.label} width={40} height={40} />
              </span>
              <span className="display mt-1.5 text-[15px] font-extrabold uppercase tracking-[0.18em] text-ink [text-shadow:0_1px_6px_rgb(7_12_23/0.9)]">
                {role.label}
              </span>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
            <div className="display truncate text-[17px] font-bold leading-tight text-ink">
              {name} {tag && <span className="text-[11px] font-normal text-ink-dim">#{tag}</span>}
            </div>
            {card ? (
              <>
                <div className="truncate text-[11.5px]" style={{ color: border }}>
                  {rankLabel({ tier: card.tier, rank: card.rank, leaguePoints: card.leaguePoints ?? 0 })}
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-line bg-line">
                  <div className="bg-panel/90 px-2 py-1">
                    <dt className="text-[9.5px] uppercase tracking-[0.12em] text-ink-dim">Win rate</dt>
                    <dd className={`display tnum text-[14px] font-semibold ${card.winRate >= 50 ? 'text-win' : 'text-loss'}`}>
                      {card.winRate}%
                    </dd>
                  </div>
                  <div className="bg-panel/90 px-2 py-1">
                    <dt className="text-[9.5px] uppercase tracking-[0.12em] text-ink-dim">Games</dt>
                    <dd className="display tnum text-[14px] font-semibold text-ink">{card.games}</dd>
                  </div>
                </dl>
                {card.championName && (
                  <div className="mt-1.5 truncate text-[11px] text-ink-muted">Most played · {card.championName}</div>
                )}
              </>
            ) : (
              <div className="text-[11.5px] text-ink-dim">{seat.bot ? 'Bot' : 'Not on Pasen'}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
