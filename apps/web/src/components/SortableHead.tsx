import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'

import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { SortDirection } from '@/hooks/useSort'

type SortableHeadProps<T> = {
  column: keyof T
  activeKey: keyof T
  direction: SortDirection
  onSort: (column: keyof T) => void
  children: React.ReactNode
  align?: 'left' | 'right'
}

export function SortableHead<T>({
  column,
  activeKey,
  direction,
  onSort,
  children,
  align = 'left',
}: SortableHeadProps<T>) {
  const active = column === activeKey
  const Arrow = direction === 'asc' ? ChevronUpIcon : ChevronDownIcon

  return (
    <TableHead
      // aria-sort is how a screen reader learns the table is sorted at all.
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('p-0', align === 'right' && 'text-right')}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'flex w-full items-center gap-1 px-2 py-2 text-[10px] uppercase tracking-[0.08em] transition-colors hover:text-ink',
          align === 'right' && 'justify-end',
          active ? 'text-ink' : 'text-ink-dim'
        )}
      >
        {children}
        <Arrow className={cn('size-3', active ? 'opacity-100' : 'opacity-0')} aria-hidden />
      </button>
    </TableHead>
  )
}
