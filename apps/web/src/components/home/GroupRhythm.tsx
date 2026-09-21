import type { ActivityDay } from '@/lib/api'

/** Eight weeks: long enough to show a habit, short enough to keep a bar readable. */
const DAYS = 56

/**
 * One bar per day, scaled to the busiest day on screen rather than to an
 * absolute: the question is what a heavy day looks like for this group, not how
 * it compares to some other group.
 */
export function GroupRhythm({ days }: { days: ActivityDay[] }) {
  const window = days.slice(-DAYS)
  if (window.length < 7) return null

  const peak = Math.max(...window.map((day) => day.memberGames), 1)
  const total = window.reduce((sum, day) => sum + day.memberGames, 0)
  const busiest = window.reduce((best, day) => (day.memberGames > best.memberGames ? day : best))

  const label = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] uppercase tracking-[0.15em] text-ink-dim">Group rhythm</h2>
        <p className="tnum text-[11px] text-ink-dim">
          {total} games over {window.length} days · busiest {busiest.memberGames}
        </p>
      </div>

      <div
        className="flex h-[92px] items-end gap-[3px] rounded-[10px] border border-line bg-panel px-3 py-2.5"
        role="img"
        aria-label={`Daily games over the last ${window.length} days, from ${label(
          window[0].date
        )} to ${label(window[window.length - 1].date)}, peaking at ${busiest.memberGames}`}
      >
        {window.map((day) => (
          <span
            key={day.date}
            title={`${label(day.date)} · ${day.memberGames} games`}
            className="min-h-[5px] flex-1 rounded-t-[3px] bg-accent/80"
            style={{ height: `${Math.max(6, Math.round((day.memberGames / peak) * 100))}%` }}
          />
        ))}
      </div>

      <div className="mt-1.5 flex justify-between text-[11px] text-ink-dim">
        <span>{label(window[0].date)}</span>
        <span>{label(window[window.length - 1].date)}</span>
      </div>
    </section>
  )
}
