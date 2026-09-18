import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'

import { Chart } from '@/components/Chart'
import { CHART, axisStyle, baseOptions } from '@/lib/chart-theme'
import type { LpPoint } from '@/lib/api'

/** Tiers are worth 400 LP each, divisions 100, so a curve can cross them. */
const TIERS = [
  'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD',
  'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER',
]
const DIVISIONS = ['IV', 'III', 'II', 'I']

/**
 * Rank as one number, so Diamond IV 90 LP and Diamond III 10 LP sit in the right
 * order. Without this a raw LP curve drops to zero on every promotion, which
 * reads as a collapse rather than a climb.
 */
function absoluteLp(point: LpPoint): number {
  const tier = TIERS.indexOf(point.tier ?? '')
  if (tier < 0) return point.leaguePoints

  // Master and above have no divisions; their LP just keeps counting.
  if (tier >= TIERS.indexOf('MASTER')) {
    return TIERS.indexOf('MASTER') * 400 + point.leaguePoints
  }

  const division = Math.max(0, DIVISIONS.indexOf(point.rank ?? 'IV'))
  return tier * 400 + division * 100 + point.leaguePoints
}

export function LpCurve({ points, queueLabel }: { points: LpPoint[]; queueLabel: string }) {
  const option = useMemo<EChartsOption>(() => {
    const data = points.map((point) => [point.capturedAt, absoluteLp(point)])

    return {
      ...baseOptions,
      tooltip: {
        ...baseOptions.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: CHART.line } },
        formatter: (params: any) => {
          const point = points[params[0].dataIndex]
          const when = new Date(point.capturedAt).toLocaleDateString('en-GB')
          return `${when}<br/>${point.tier} ${point.rank ?? ''} · ${point.leaguePoints} LP<br/>${point.wins}W ${point.losses}L`
        },
      },
      xAxis: { type: 'time', ...axisStyle, splitLine: { show: false } },
      yAxis: {
        type: 'value',
        ...axisStyle,
        scale: true,
        axisLabel: {
          ...axisStyle.axisLabel,
          formatter: (value: number) => {
            const tier = Math.floor(value / 400)
            return TIERS[tier]?.slice(0, 3) ?? ''
          },
        },
      },
      series: [
        {
          type: 'line',
          name: queueLabel,
          data,
          smooth: false,
          symbol: 'circle',
          symbolSize: 8,
          showSymbol: points.length <= 60,
          lineStyle: { width: 2, color: CHART.accent },
          itemStyle: { color: CHART.accent },
          areaStyle: { color: 'rgba(232, 101, 12, 0.10)' },
        },
      ],
    }
  }, [points, queueLabel])

  if (points.length < 2) {
    return (
      <p className="bg-panel px-4 py-6 text-center text-[12px] text-ink-muted">
        Not enough snapshots yet. The curve fills in as rank is polled each hour.
      </p>
    )
  }

  return <Chart option={option} height={200} ariaLabel={`Rank over time in ${queueLabel}`} />
}
