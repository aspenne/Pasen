import { useMemo, useState } from 'react'

export type SortDirection = 'asc' | 'desc'

/**
 * Column sorting for the tables on the site.
 *
 * Deliberately not TanStack Table: these are a few dozen rows already in memory
 * with no grouping, no virtualisation and no column resizing, so a headless
 * table library would be a dependency paying for features nothing here uses.
 */
export function useSort<T>(rows: T[], initialKey: keyof T, initialDirection: SortDirection = 'desc') {
  const [key, setKey] = useState<keyof T>(initialKey)
  const [direction, setDirection] = useState<SortDirection>(initialDirection)

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const left = a[key]
      const right = b[key]

      const comparison =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right))

      return direction === 'asc' ? comparison : -comparison
    })
  }, [rows, key, direction])

  /**
   * Clicking a new column starts descending: every sortable column here holds a
   * "more is more" number, and nobody opens a champion table to see their least
   * played pick first.
   */
  const toggle = (next: keyof T) => {
    if (next === key) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setKey(next)
    setDirection('desc')
  }

  return { sorted, key, direction, toggle }
}
