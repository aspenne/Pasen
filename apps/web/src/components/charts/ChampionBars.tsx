import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'

import { Chart } from '@/components/Chart'
import { CHART, axisStyle, baseOptions } from '@/lib/chart-theme'
import type { ChampionPoolEntry } from '@/lib/api'

/**
 * Games per champion. Magnitude across a handful of named things, so horizontal
 * bars: the labels are words and read far better along the left edge than
 * rotated under a vertical axis.
 */
export function ChampionBars({ entries }: { entries: ChampionPoolEntry[] }) {
  const option = useMemo<EChartsOption>(() => {
    // ECharts draws a category axis bottom-up, so reverse to put the most played
    // champion at the top.
    const top = entries.slice(0, 10).reverse()

    return {
      ...baseOptions,
      // Champion names on the left, the win-rate label on the right.
      grid: { left: 76, right: 46, top: 8, bottom: 24 },
      tooltip: {
        ...baseOptions.tooltip,
        formatter: (params: any) => {
          const entry = top[params.dataIndex]
          return `${entry.championName}<br/>${entry.games} games · ${entry.winRate}% · ${entry.kda} KDA`
        },
      },
      xAxis: { type: 'value', ...axisStyle, axisLine: { show: false } },
      yAxis: {
        type: 'category',
        data: top.map((entry) => entry.championName),
        ...axisStyle,
        splitLine: { show: false },
        axisLabel: { ...axisStyle.axisLabel, color: CHART.inkMuted },
      },
      series: [
        {
          type: 'bar',
          data: top.map((entry) => ({
            value: entry.games,
            // Win rate is polarity, so the bar carries which side of even the
            // champion sits on rather than a decorative hue.
            itemStyle: { color: entry.winRate >= 50 ? CHART.win : CHART.loss },
          })),
          barWidth: 12,
          // 4px rounded data-ends, anchored to the baseline.
          itemStyle: { borderRadius: [0, 4, 4, 0] },
          label: {
            show: true,
            position: 'right',
            formatter: (params: any) => `${top[params.dataIndex].winRate}%`,
            color: CHART.inkMuted,
            fontSize: 10,
          },
        },
      ],
    }
  }, [entries])

  return <Chart option={option} height={260} ariaLabel="Most played champions, by games" />
}
