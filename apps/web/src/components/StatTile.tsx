type StatTileProps = {
  label: string
  value: string | number
  /** Optional qualifier under the value: "of 173", "2W 2L". */
  detail?: string
  /** Tints the value only. Labels and details always wear text tokens. */
  tone?: 'default' | 'gold' | 'win' | 'loss'
}

const TONES = {
  default: 'text-ink',
  gold: 'text-gold',
  win: 'text-win',
  loss: 'text-loss',
} as const

export function StatTile({ label, value, detail, tone = 'default' }: StatTileProps) {
  return (
    <div className="bg-panel px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.08em] text-ink-dim">{label}</div>
      <div className={`tnum mt-0.5 text-[22px] leading-none ${TONES[tone]}`}>{value}</div>
      {detail && <div className="mt-1 text-[11px] text-ink-muted">{detail}</div>}
    </div>
  )
}
