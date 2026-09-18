/**
 * One theme, read by every chart, so a hue means the same thing everywhere.
 *
 * Orange is the series colour: it ties a chart to the brand without adding a
 * palette of its own. Blue and red stay reserved for results, so a chart never
 * has to explain whether its orange means "good".
 */
export const CHART = {
  surface: '#161b26',
  ink: '#f0f3f8',
  inkMuted: '#8a94a6',
  inkDim: '#6e7a8f',
  line: '#1e2430',
  accent: '#e8650c',
  win: '#4c8dff',
  loss: '#e5484d',
} as const

/**
 * Sequential ramp for magnitude: one hue, surface-dark to bright, never a
 * rainbow. The lowest step sits almost on the card so an empty day in the
 * activity calendar reads as absence rather than as a small value.
 */
export const SEQUENTIAL_ACCENT = ['#1e2430', '#4a2e14', '#7a4718', '#b0591a', '#e8650c']

/**
 * Diverging ramp for polarity, anchored on a neutral midpoint. Blue and red
 * rather than the brand orange: a duo above or below even is a result, and
 * results wear the result colours. The pair measures deltaE 26.4 under
 * protanopia, so which side of even a duo sits on is never in doubt.
 */
export const DIVERGING_WINRATE = ['#e5484d', '#7a3d47', '#2a3142', '#3a6ba8', '#4c8dff']

/**
 * Thresholds for a win rate, centred on 50 rather than on the data, so the
 * midpoint is a property of the question - even or not - instead of an artefact
 * of whatever range happens to be on screen that day.
 */
export const WIN_RATE_PIECES = [
  { lt: 45, color: DIVERGING_WINRATE[0] },
  { gte: 45, lt: 48.5, color: DIVERGING_WINRATE[1] },
  { gte: 48.5, lte: 51.5, color: DIVERGING_WINRATE[2] },
  { gt: 51.5, lte: 55, color: DIVERGING_WINRATE[3] },
  { gt: 55, color: DIVERGING_WINRATE[4] },
]

/**
 * Base options shared by every chart: recessive axes, tooltip on the raised
 * surface. Deliberately not `as const` - that would freeze `padding` into a
 * readonly tuple, which ECharts' own option types reject.
 */
export const baseOptions = {
  backgroundColor: 'transparent',
  textStyle: { color: CHART.inkMuted, fontSize: 12 },
  /*
   * Explicit margins, not containLabel and not outerBounds. ECharts 6
   * deprecated containLabel, and outerBounds only clamps a grid still using its
   * default 10%/60px margins - which leaves almost no plot area on a card.
   */
  grid: { left: 40, right: 16, top: 16, bottom: 28 },
  tooltip: {
    backgroundColor: '#181e2a',
    borderColor: CHART.line,
    borderWidth: 1,
    padding: [9, 12],
    textStyle: { color: CHART.ink, fontSize: 13 },
    extraCssText: 'box-shadow: none; border-radius: 12px;',
  },
}

export const axisStyle = {
  axisLine: { lineStyle: { color: CHART.line } },
  axisTick: { show: false },
  axisLabel: { color: CHART.inkDim, fontSize: 11 },
  splitLine: { lineStyle: { color: CHART.line, type: 'dashed' as const } },
}
