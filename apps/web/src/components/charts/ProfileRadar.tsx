import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'

import { Chart } from '@/components/Chart'
import { CHART, baseOptions } from '@/lib/chart-theme'
import type { MemberTotals } from '@/lib/api'

type ProfileRadarProps = {
  member: MemberTotals
  /** Everyone in the group, used to scale each axis. */
  roster: MemberTotals[]
  color: string
}

const AXES = [
  { key: 'kda', label: 'KDA' },
  { key: 'csPerMinute', label: 'CS/min' },
  { key: 'visionPerGame', label: 'Vision' },
  { key: 'winRate', label: 'Win rate' },
  { key: 'games', label: 'Games' },
  { key: 'championsPlayed', label: 'Pool' },
] as const

/**
 * A player's shape against the group's.
 *
 * Each axis is scaled to the group's own maximum rather than to an absolute:
 * "a lot of vision" only means anything next to the people you actually play
 * with. The group average is drawn as the second series so the comparison is on
 * the chart rather than in the reader's head.
 */
export function ProfileRadar({ member, roster, color }: ProfileRadarProps) {
  const option = useMemo<EChartsOption>(() => {
    const maxima = AXES.map(({ key }) =>
      Math.max(1, ...roster.map((entry) => entry[key] as number))
    )

    const average = AXES.map(
      ({ key }) =>
        roster.reduce((total, entry) => total + (entry[key] as number), 0) / (roster.length || 1)
    )

    return {
      ...baseOptions,
      tooltip: { ...baseOptions.tooltip, trigger: 'item' },
      legend: {
        bottom: 0,
        itemWidth: 9,
        itemHeight: 9,
        icon: 'roundRect',
        textStyle: { color: CHART.inkMuted, fontSize: 11 },
        data: [member.displayName, 'Group average'],
      },
      radar: {
        indicator: AXES.map(({ label }, index) => ({ name: label, max: maxima[index] })),
        radius: '68%',
        center: ['50%', '47%'],
        axisName: { color: CHART.inkMuted, fontSize: 11 },
        splitLine: { lineStyle: { color: CHART.line } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: CHART.line } },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              name: member.displayName,
              value: AXES.map(({ key }) => member[key] as number),
              lineStyle: { width: 2, color },
              itemStyle: { color },
              areaStyle: { color, opacity: 0.22 },
            },
            {
              name: 'Group average',
              value: average.map((value) => Math.round(value * 10) / 10),
              lineStyle: { width: 2, color: CHART.inkDim, type: 'dashed' },
              itemStyle: { color: CHART.inkDim },
              areaStyle: { opacity: 0 },
            },
          ],
        },
      ],
    }
  }, [member, roster, color])

  return (
    <Chart
      option={option}
      height={260}
      ariaLabel={`${member.displayName} compared with the group average across KDA, CS per minute, vision, win rate, games played and champion pool`}
    />
  )
}
