import type { ReactNode } from 'react'

type StatTileProps = {
  label: string
  value: ReactNode
  /** Optional qualifier under the value: "of 173", "2W 2L". */
  detail?: string
  /** Tints the value only. Labels and details always wear text tokens. */
  tone?: 'default' | 'accent' | 'win' | 'loss'
}

const TONES = {
  default: 'text-ink',
  accent: 'text-accent',
  win: 'text-win',
  loss: 'text-loss',
} as const

export function StatTile({ label, value, detail, tone = 'default' }: StatTileProps) {
  return (
    <div className="rounded-[16px] bg-panel px-[17px] py-[15px]">
      <div className="text-[12px] text-ink-dim">{label}</div>
      {/* Proportional figures: tabular ones read loose at this size. */}
      <div className={`mt-1 text-[22px] leading-none ${TONES[tone]}`}>{value}</div>
      {detail && <div className="mt-1.5 text-[12px] text-ink-muted">{detail}</div>}
    </div>
  )
}
