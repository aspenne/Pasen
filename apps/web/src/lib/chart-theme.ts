/**
 * One theme, registered once. Every chart on the site reads its colours from
 * here so a hue means the same thing on every screen.
 */
export const CHART = {
  surface: '#111725',
  ink: '#e8ecf4',
  inkMuted: '#7a869e',
  inkDim: '#5a6580',
  line: '#1a2030',
  gold: '#d4af5a',
  win: '#4ecda4',
  loss: '#e24b4a',
} as const

/**
 * Sequential ramp for magnitude: one hue, surface-dark to bright, never a
 * rainbow. Low values sit almost on the card so an empty day reads as absence
 * rather than as a value.
 */
export const SEQUENTIAL_GOLD = ['#1a2030', '#4a4130', '#7a6738', '#a98d45', '#d4af5a']

/**
 * Diverging ramp for polarity, anchored on a neutral midpoint: a duo's win rate
 * is only meaningful against the 50% line.
 */
export const DIVERGING_WINRATE = ['#e24b4a', '#7a3d47', '#2a3142', '#2f7a63', '#4ecda4']

/**
 * Thresholds for a win rate, centred on 50 rather than on the data. A piecewise
 * scale rather than a continuous one so the midpoint is a property of the
 * question - even or not - instead of an artefact of whatever range happens to
 * be on screen that day.
 */
export const WIN_RATE_PIECES = [
  { lt: 45, color: DIVERGING_WINRATE[0] },
  { gte: 45, lt: 48.5, color: DIVERGING_WINRATE[1] },
  { gte: 48.5, lte: 51.5, color: DIVERGING_WINRATE[2] },
  { gt: 51.5, lte: 55, color: DIVERGING_WINRATE[3] },
  { gt: 55, color: DIVERGING_WINRATE[4] },
]

/**
 * Base options shared by every chart: recessive axes, tooltip on the surface.
 *
 * Deliberately not `as const`: it would freeze `padding` into a readonly tuple,
 * which ECharts' own option types reject.
 */
export const baseOptions = {
  backgroundColor: 'transparent',
  textStyle: { color: CHART.inkMuted, fontSize: 11 },
  /*
   * Explicit margins, not containLabel and not outerBounds. ECharts 6 deprecated
   * containLabel, and outerBounds only clamps a grid that still uses its default
   * 10%/60px margins - which leaves almost no plot area on a small card. Every
   * chart that uses a grid states the room its labels need.
   */
  grid: { left: 40, right: 16, top: 16, bottom: 28 },
  tooltip: {
    backgroundColor: '#161d2e',
    borderColor: CHART.line,
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: CHART.ink, fontSize: 12 },
    extraCssText: 'box-shadow: none;',
  },
}

export const axisStyle = {
  axisLine: { lineStyle: { color: CHART.line } },
  axisTick: { show: false },
  axisLabel: { color: CHART.inkDim, fontSize: 10 },
  splitLine: { lineStyle: { color: CHART.line, type: 'dashed' as const } },
}
