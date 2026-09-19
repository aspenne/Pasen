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
  const option = useMemo<EChartsOption>(() => {
    // One tint for the whole curve: where the player stands now.
    const color = TIER_HEX[(points.at(-1)?.tier ?? '').toUpperCase()] ?? CHART.accent
    const apex = points.length > 0 && points.every(apexPoint)

    const data = points.map((point) => [
      point.capturedAt,
      apex ? point.leaguePoints : absoluteLp(point),
    ])

    return {
      ...baseOptions,
      grid: { ...baseOptions.grid, left: apex ? 52 : 68 },
      tooltip: {
        ...baseOptions.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: CHART.line } },
        formatter: (params: any) => {
          const point = points[params[0].dataIndex]
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
          showSymbol: points.length <= 60,
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
  }, [points, queueLabel])

  if (points.length < 2) {
    return (
      <p className="rounded-[6px] border border-line bg-panel px-4 py-6 text-center text-[12px] text-ink-muted">
        Not enough snapshots yet. The curve fills in as rank is polled each hour.
      </p>
    )
  }

  return <Chart option={option} height={200} ariaLabel={`Rank over time in ${queueLabel}`} />
}
