import type { LpPoint, MemberRank } from '@/lib/api'
import { rankLabel, tierColor, tierCrest } from '@/lib/format'

type RankPanelProps = {
  ranks: MemberRank[]
  /** Ranked solo snapshots, used for the peak. Empty until the first capture. */
  points: LpPoint[]
}

const QUEUE_NAMES: Record<string, string> = {
  RANKED_SOLO_5x5: 'Ranked solo',
  RANKED_FLEX_SR: 'Ranked flex',
  RANKED_PREMADE_5x5: 'Ranked 5v5',
}

/**
 * One row per queue the member is ranked in, carrying the whole standing:
 * crest, tier, LP, ladder record and ladder win rate. The tier's colour is on
 * the LP and the crest, never alone - Master and Diamond are the same colour to
 * a protanope, so the tier's name is always written beside it.
 */
export function RankPanel({ ranks, points }: RankPanelProps) {
  if (ranks.length === 0) return null

  const peak = points.reduce<number | null>(
    (best, point) => (best === null || point.leaguePoints > best ? point.leaguePoints : best),
    null
  )

  return (
    <div className="divide-y divide-line rounded-[8px] border border-line bg-panel">
      {ranks.map((rank) => {
        const color = tierColor(rank.tier)
        const crest = tierCrest(rank.tier)
        const played = rank.wins + rank.losses
        const winRate = played > 0 ? Math.round((rank.wins / played) * 1000) / 10 : null
        const solo = rank.queueType === 'RANKED_SOLO_5x5'

        return (
          <div key={rank.queueType} className="flex items-center gap-4 px-4 py-3.5">
            {crest && <img src={crest} alt="" aria-hidden width={38} height={38} className="shrink-0" />}

            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.13em] text-ink-dim">
                {QUEUE_NAMES[rank.queueType] ?? rank.queueType.replace(/_/g, ' ').toLowerCase()}
              </div>
              <div className="display mt-1 truncate text-[17px] font-semibold" style={{ color }}>
                {rankLabel(rank)}
              </div>
            </div>

            <dl className="flex shrink-0 gap-5 text-right">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.13em] text-ink-dim">Record</dt>
                <dd className="tnum mt-1 text-[13px] text-ink">
                  {rank.wins}W {rank.losses}L
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.13em] text-ink-dim">Win rate</dt>
                <dd
                  className={`tnum mt-1 text-[13px] ${
                    winRate !== null && winRate >= 50 ? 'text-win' : 'text-loss'
                  }`}
                >
                  {winRate === null ? '—' : `${winRate}%`}
                </dd>
              </div>
              {/* Only solo has an LP history behind it, and only once captured. */}
              {solo && peak !== null && (
                <div className="hidden sm:block">
                  <dt className="text-[10px] uppercase tracking-[0.13em] text-ink-dim">
                    Peak tracked
                  </dt>
                  <dd className="tnum mt-1 text-[13px] text-ink-muted">{peak} LP</dd>
                </div>
              )}
            </dl>
          </div>
        )
      })}
    </div>
  )
}
