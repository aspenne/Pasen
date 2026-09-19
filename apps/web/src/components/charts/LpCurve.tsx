import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'

import { Chart } from '@/components/Chart'
import { CHART, TIER_HEX, axisStyle, baseOptions } from '@/lib/chart-theme'
import type { LpPoint } from '@/lib/api'

/** Tiers are worth 400 LP each, divisions 100, so a curve can cross them. */
const TIERS = [
  'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD',
  'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER',
]
const DIVISIONS = ['IV', 'III', 'II', 'I']
const MASTER = TIERS.indexOf('MASTER')

/** Short enough for an axis, and still a word rather than three letters. */
const TIER_LABELS = [
  'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald',
  'Diamond', 'Master', 'GM', 'Chall',
]

const apexPoint = (point: LpPoint) => TIERS.indexOf(point.tier ?? '') >= MASTER

/**
 * Rank as one number, so Diamond IV 90 LP and Diamond III 10 LP sit in the right
 * order. Without this a raw LP curve drops to zero on every promotion, which
 * reads as a collapse rather than a climb.
 *
 * Only meaningful below Master. Apex LP is unbounded - 800 LP is an ordinary
 * Master score - so it cannot share a scale that spends 400 per tier; a curve
 * up there is plotted on raw LP instead.
 */
function absoluteLp(point: LpPoint): number {
  const tier = TIERS.indexOf(point.tier ?? '')
  if (tier < 0) return point.leaguePoints

  const division = Math.max(0, DIVISIONS.indexOf(point.rank ?? 'IV'))
  return tier * 400 + division * 100 + point.leaguePoints
}

export function LpCurve({ points, queueLabel }: { points: LpPoint[]; queueLabel: string }) {
  /*
   * A standing is written down only when it moves, so one row means the rank
   * has not changed since - not that we stopped looking. Carrying that single
   * value forward to now draws the flat line that is the truth, rather than
   * withholding the chart until something happens.
   */
  const plotted = useMemo<LpPoint[]>(
    () =>
      points.length === 1
        ? [points[0], { ...points[0], capturedAt: new Date().toISOString() }]
        : points,
    [points]
  )

  const option = useMemo<EChartsOption>(() => {
    // One tint for the whole curve: where the player stands now.
    const color = TIER_HEX[(plotted.at(-1)?.tier ?? '').toUpperCase()] ?? CHART.accent
    const apex = plotted.length > 0 && plotted.every(apexPoint)

    const values = plotted.map((point) => (apex ? point.leaguePoints : absoluteLp(point)))
    const data = plotted.map((point, index) => [point.capturedAt, values[index]])

    /*
     * An unmoved rank gives every point the same value, and an auto-scaled axis
     * collapses to a single line with nothing around it. Padding the range puts
     * the flat line where it belongs: in the middle.
     */
    const flat = Math.min(...values) === Math.max(...values)
    let flatBounds = {}
    if (flat) {
      flatBounds = apex
        ? { min: Math.max(0, values[0] - 25), max: values[0] + 25 }
        : /*
           * Below Master the gridlines are the tier boundaries, 400 apart. A
           * narrow window around the value would contain none of them and leave
           * the axis blank, so the range becomes the tier the player sits in -
           * which also shows how far into it they are.
           */
          {
            min: Math.floor(values[0] / 400) * 400,
            max: Math.floor(values[0] / 400) * 400 + 400,
          }
    }

    return {
      ...baseOptions,
      grid: { ...baseOptions.grid, left: apex ? 52 : 68 },
      tooltip: {
        ...baseOptions.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: CHART.line } },
        formatter: (params: any) => {
          const point = plotted[params[0].dataIndex]
          const when = new Date(point.capturedAt).toLocaleDateString('en-GB')
          const tier = point.tier
            ? TIER_LABELS[TIERS.indexOf(point.tier)] ?? point.tier
            : 'Unranked'
          const division = apexPoint(point) ? '' : ` ${point.rank ?? ''}`
          return `${when}<br/>${tier}${division} · ${point.leaguePoints} LP<br/>${point.wins}W ${point.losses}L`
        },
      },
      xAxis: { type: 'time', ...axisStyle, splitLine: { show: false } },
      yAxis: {
        type: 'value',
        ...axisStyle,
        scale: true,
        // Below Master a gridline every 400 lands exactly on a tier boundary.
        ...(apex ? {} : { interval: 400 }),
        ...flatBounds,
        axisLabel: {
          ...axisStyle.axisLabel,
          formatter: (value: number) =>
            apex ? `${Math.round(value)} LP` : (TIER_LABELS[Math.floor(value / 400)] ?? ''),
        },
      },
      series: [
        {
          type: 'line',
          name: queueLabel,
          data,
          smooth: false,
          symbol: 'circle',
          symbolSize: 7,
          showSymbol: plotted.length <= 60,
          lineStyle: { width: 2, color },
          itemStyle: { color },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: `${color}2e` },
                { offset: 1, color: `${color}00` },
              ],
            },
          },
        },
      ],
    }
  }, [plotted, queueLabel])

  if (points.length === 0) {
    return (
      <p className="rounded-[6px] border border-line bg-panel px-4 py-6 text-center text-[12px] text-ink-muted">
        No standing captured yet in {queueLabel.toLowerCase()}. Rank is polled each hour.
      </p>
    )
  }

  const only = points.length === 1 ? points[0] : null

  return (
    <>
      <Chart option={option} height={200} ariaLabel={`Rank over time in ${queueLabel}`} />
      {only && (
        <p className="mt-1 text-center text-[11px] text-ink-dim">
          Unchanged since{' '}
          {new Date(only.capturedAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
          })}
          , the only standing recorded so far.
        </p>
      )}
    </>
  )
}
