/**
 * One theme, read by every chart, so a hue means the same thing everywhere.
 *
 * Gold is the series colour: it ties a chart to the identity without adding a
 * palette of its own. Green and red stay reserved for results, so a chart never
 * has to explain whether its gold means "good".
 */
export const CHART = {
  /* The panel is opaque now, so this is simply its value. */
  surface: '#0d1526',
  ink: '#eef2fa',
  inkMuted: '#aab6cc',
  inkDim: '#7e8ca6',
  line: '#1b2942',
  accent: '#ffc247',
  win: '#43d9a3',
  loss: '#ff3e29',
} as const

/**
 * Sequential ramp for magnitude: one hue, surface-dark to bright, never a
 * rainbow. The lowest step sits almost on the card so an empty day in the
 * activity calendar reads as absence rather than as a small value.
 */
export const SEQUENTIAL_ACCENT = ['#101a2c', '#44413c', '#7e6a47', '#bc954b', '#ffc247']

/**
 * Diverging ramp for polarity, anchored on a neutral midpoint, stepped in OKLab
 * so the two halves move at the same pace. Green and red rather than the gold:
 * a duo above or below even is a result, and results wear the result colours.
 * The two ends measure deltaE 16.8 under deuteranopia - the tightest view for
 * this pair, and the reason the red is the saturated one rather than a coral.
 */
export const DIVERGING_WINRATE = ['#ff3e29', '#904347', '#26304a', '#3a8077', '#43d9a3']

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
  textStyle: { color: CHART.inkMuted, fontSize: 12, fontFamily: 'Saira, sans-serif' },
  /*
   * Explicit margins, not containLabel and not outerBounds. ECharts 6
   * deprecated containLabel, and outerBounds only clamps a grid still using its
   * default 10%/60px margins - which leaves almost no plot area on a card.
   */
  grid: { left: 40, right: 16, top: 16, bottom: 28 },
  tooltip: {
    backgroundColor: '#121d33',
    borderColor: CHART.line,
    borderWidth: 1,
    padding: [9, 12],
    textStyle: { color: CHART.ink, fontSize: 13 },
    extraCssText: 'box-shadow: none; border-radius: 6px;',
  },
}

export const axisStyle = {
  axisLine: { lineStyle: { color: CHART.line } },
  axisTick: { show: false },
  axisLabel: { color: CHART.inkDim, fontSize: 11 },
  splitLine: { lineStyle: { color: CHART.line, type: 'dashed' as const } },
}

/**
 * Tier colours as literals, because charts paint to canvas and cannot resolve a
 * CSS variable. Only ever as a single series' tint - one player's own curve
 * wearing their own rank. Using this set to tell several series apart is what
 * the stylesheet forbids: Master and Diamond are deltaE 0.3 under protanopia.
 */
export const TIER_HEX: Record<string, string> = {
  IRON: '#8c8c8c',
  BRONZE: '#bd7b4a',
  SILVER: '#a8b4c0',
  GOLD: '#e0b352',
  PLATINUM: '#3fc0c4',
  EMERALD: '#35c46b',
  DIAMOND: '#6aa9ff',
  MASTER: '#c89bff',
  GRANDMASTER: '#e5646a',
  CHALLENGER: '#f0cb6b',
}
