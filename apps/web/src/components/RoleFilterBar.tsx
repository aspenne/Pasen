import { ROLE_FILTERS, type RoleFilter } from '@/lib/roles'
import { roleIcon } from '@/lib/roulette'

/** All / Top / Jungle / Mid / Bot / Support, above any champion grid. */
export function RoleFilterBar({ value, onChange }: { value: RoleFilter; onChange: (next: RoleFilter) => void }) {
  return (
    <div role="radiogroup" aria-label="Role" className="flex flex-wrap gap-1">
      {ROLE_FILTERS.map((filter) => {
        const active = value === filter.key
        return (
          <button
            key={filter.key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={filter.label}
            title={filter.label}
            onClick={() => onChange(filter.key)}
            className={`tap inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] transition-colors ${
              active ? 'bg-accent text-on-accent' : 'bg-panel-raised text-ink-muted hover:text-ink'
            }`}
          >
            {filter.icon ? (
              <img
                src={roleIcon(filter.icon as Parameters<typeof roleIcon>[0])}
                alt=""
                width={16}
                height={16}
                className={active ? 'brightness-0' : ''}
              />
            ) : (
              filter.label
            )}
          </button>
        )
      })}
    </div>
  )
}
