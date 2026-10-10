import type { inhouseRecordOf } from '@/lib/customs'

type InhouseRecordData = ReturnType<typeof inhouseRecordOf>

/**
 * A player's inhouse standing, the headline of their profile when it is
 * filtered to customs: the same numbers as the wins table on the Customs
 * page, so the two never disagree.
 */
export function InhouseRecord({ record }: { record: InhouseRecordData }) {
  if (!record) {
    return (
      <p className="bg-panel px-4 py-3 text-[13px] text-ink-muted">
        No settled custom yet: a game counts here once someone knows who won it.
      </p>
    )
  }

  return (
    <section className="flex flex-wrap items-center gap-x-8 gap-y-3 border-l-2 border-accent bg-panel px-5 py-4">
      <h2 className="text-[11px] uppercase tracking-[0.15em] text-ink-dim">Inhouse record</h2>
      <Figure label="Record" value={`${record.wins}W ${record.losses}L`} />
      <Figure
        label="Win rate"
        value={`${record.winRate}%`}
        tone={record.winRate >= 50 ? 'text-win' : 'text-loss'}
      />
      <Figure label="Wins table" value={`#${record.place} of ${record.of}`} tone={record.place === 1 ? 'text-accent' : undefined} />
    </section>
  )
}

function Figure({ label, value, tone = 'text-ink' }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[11px] text-ink-dim">{label}</div>
      <div className={`display tnum text-[20px] font-semibold leading-tight ${tone}`}>{value}</div>
    </div>
  )
}
