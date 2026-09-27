import { ChampionIcon } from '@/components/ChampionIcon'
import { CountUp } from '@/components/CountUp'
import type { DailyFeed, StaticData } from '@/lib/api'
import { championCentered, championSplash } from '@/lib/ddragon'

export type DayStandout = {
  displayName: string
  championId: number
  championName: string
  kills: number
  deaths: number
  assists: number
}

type GroupHeroProps = {
  name: string
  /** The day being shown, which is not always today. */
  dateLabel: string
  totals: DailyFeed['totals'] | undefined
  /** Games the group has played together, all time. */
  groupGames: number
  members: number
  /** The day's most striking line, named on the art. */
  standout: DayStandout | null
  /** Champion behind the art: the standout's, or the roster's most played. */
  backdropChampionId?: number
  staticData?: StaticData
}

/**
 * The day, told on the art of the champion behind its best line.
 *
 * The old banner gave the group's name and a count. That is what the page
 * already says everywhere else; what it never said was what kind of day this
 * was, which is the one thing someone opening the site at midnight wants.
 */
export function GroupHero({
  name,
  dateLabel,
  totals,
  groupGames,
  members,
  standout,
  backdropChampionId,
  staticData,
}: GroupHeroProps) {
  const championId = standout?.championId ?? backdropChampionId
  const art =
    championCentered(championId) ??
    championSplash(staticData?.champions?.[String(championId ?? '')]?.slug) ??
    null

  const played = totals?.games ?? 0

  return (
    <section className="relative flex min-h-[236px] flex-col justify-end overflow-hidden rounded-[10px] border border-line bg-panel px-6 py-5">
      {art && (
        <img
          src={art}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover object-[center_24%]"
        />
      )}
      {/* Clear at the top where the art lives, opaque where every word sits. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(183deg, #070C1700 6%, #070C1766 36%, #070C17E6 72%, #070C17 100%)',
        }}
      />

      {standout && (
        <div className="relative mb-auto flex w-fit items-center gap-2 rounded-full border border-line-strong bg-ground/70 py-1.5 pl-1.5 pr-3.5 backdrop-blur">
          <ChampionIcon
            championId={standout.championId}
            championName={standout.championName}
            staticData={staticData}
            size={22}
            className="rounded-full"
          />
          <span className="text-[12px] text-ink">
            <b className="font-semibold">{standout.displayName}</b>{' '}
            <span className="tnum text-ink-muted">
              {standout.kills} / {standout.deaths} / {standout.assists}
            </span>{' '}
            <span className="text-ink-muted">on {standout.championName}</span>
          </span>
        </div>
      )}

      <div className="relative flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="text-[12px] text-ink-muted">
            {name} · {dateLabel}
          </div>
          <h1 className="display mt-1 text-[30px] font-bold leading-none">
            <CountUp value={played} /> {played === 1 ? 'game' : 'games'}
          </h1>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-muted">
            <span>
              <b className="text-ink">{totals?.wins ?? 0}</b> won
            </span>
            <span>
              <b className="text-ink">{totals?.losses ?? 0}</b> lost
            </span>
            <span>
              <b className="text-ink">{totals?.championsPlayed ?? 0}</b> champions
            </span>
            <span className="hidden sm:inline">
              <b className="text-ink">{members}</b> members · {groupGames.toLocaleString('en-GB')}{' '}
              games together
            </span>
          </div>
        </div>

        <div className="ml-auto shrink-0 text-right">
          <div className="display text-[40px] font-bold leading-none text-accent">
            <CountUp value={totals?.winRate ?? 0} decimals={1} suffix="%" />
          </div>
          <div className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-ink-dim">
            win rate
          </div>
        </div>
      </div>
    </section>
  )
}
