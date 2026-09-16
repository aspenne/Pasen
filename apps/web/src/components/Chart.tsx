import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, HeatmapChart, LineChart, RadarChart } from 'echarts/charts'
import {
  CalendarComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
  VisualMapContinuousComponent,
  VisualMapPiecewiseComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'

// Registered once for the whole app rather than pulling the full bundle: the
// difference is roughly 1 MB of JavaScript.
echarts.use([
  BarChart,
  LineChart,
  HeatmapChart,
  RadarChart,
  CalendarComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  // A cartesian heatmap refuses to render without a visualMap - it throws
  // "Heatmap must use with visualMap" - so both flavours are registered
  // explicitly rather than trusting the umbrella export to pull them in.
  // A heatmap refuses to render without a visualMap - it throws "Heatmap must
  // use with visualMap" - so the mapping components are registered explicitly.
  VisualMapComponent,
  VisualMapContinuousComponent,
  VisualMapPiecewiseComponent,
  CanvasRenderer,
])

type ChartProps = {
  option: EChartsOption
  height: number
  /** Screen-reader summary. A canvas chart is otherwise a blank to assistive tech. */
  ariaLabel: string
}

export function Chart({ option, height, ariaLabel }: ChartProps) {
  const container = useRef<HTMLDivElement>(null)
  const instance = useRef<echarts.ECharts | null>(null)
  /** Held so an option set before the chart exists is applied at init. */
  const pending = useRef<EChartsOption | null>(null)

  useEffect(() => {
    const element = container.current
    if (!element) return

    /*
     * Initialise as soon as the element has a size, and again from the observer
     * if it did not yet. echarts.init on a zero-size element warns and lays the
     * chart out against an empty box, but waiting *only* for the observer is
     * worse: it never fires for an element that is not being rendered - a
     * background tab, a hidden pane - and the chart then never appears at all.
     */
    const initIfSized = () => {
      if (instance.current || !element.clientWidth || !element.clientHeight) return

      instance.current = echarts.init(element, undefined, { renderer: 'canvas' })
      if (pending.current) {
        instance.current.setOption(pending.current, { notMerge: true })
      }
    }

    initIfSized()

    /*
     * The same observer keeps it in step afterwards: a canvas chart does not
     * reflow on its own, so a card that changes width on a phone rotation would
     * otherwise keep the old geometry.
     */
    const observer = new ResizeObserver(() => {
      initIfSized()
      instance.current?.resize()
    })

    observer.observe(element)

    return () => {
      observer.disconnect()
      instance.current?.dispose()
      instance.current = null
    }
  }, [])

  useEffect(() => {
    pending.current = option
    // notMerge, so a series disappearing from the data disappears from the chart
    // instead of lingering from the previous option.
    instance.current?.setOption(option, { notMerge: true })
  }, [option])

  return (
    <div
      ref={container}
      role="img"
      aria-label={ariaLabel}
      style={{ height }}
      className="w-full"
    />
  )
}
