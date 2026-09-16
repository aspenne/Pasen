import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'

import { Chart } from '@/components/Chart'
import { CHART, SEQUENTIAL_GOLD, baseOptions } from '@/lib/chart-theme'
import type { ActivityDay } from '@/lib/api'

/**
 * Games per day over a year. Magnitude on a date grid, so one hue from
 * near-surface to bright: an empty day should read as absence, not as a value.
 */
export function ActivityCalendar({ days, year }: { days: ActivityDay[]; year: number }) {
  const option = useMemo<EChartsOption>(() => {
    const inYear = days.filter((day) => day.date.startsWith(String(year)))
    const busiest = Math.max(1, ...inYear.map((day) => day.games))

    return {
      ...baseOptions,
      tooltip: {
        ...baseOptions.tooltip,
        formatter: (params: any) => {
          const day = inYear.find((entry) => entry.date === params.value[0])
          if (!day) return ''
          const rate = Math.round((day.wins / day.memberGames) * 100)
          return `${day.date}<br/>${day.games} matches · ${day.memberGames} played · ${rate}% won`
        },
      },
      visualMap: { min: 0, max: busiest, show: false, inRange: { color: SEQUENTIAL_GOLD } },
      calendar: {
        top: 24,
        left: 32,
        right: 10,
        cellSize: ['auto', 13],
        range: String(year),
        itemStyle: { color: CHART.line, borderColor: CHART.surface, borderWidth: 2 },
        splitLine: { show: false },
        yearLabel: { show: false },
        dayLabel: { color: CHART.inkDim, fontSize: 9 },
        monthLabel: { color: CHART.inkDim, fontSize: 10 },
      },
      series: [
        {
          type: 'heatmap',
          coordinateSystem: 'calendar',
          data: inYear.map((day) => [day.date, day.games]),
          itemStyle: { borderColor: CHART.surface, borderWidth: 2 },
        },
      ],
    }
  }, [days, year])

  return <Chart option={option} height={185} ariaLabel={`Games played each day of ${year}`} />
}
