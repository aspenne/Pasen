import type { DraftRole } from '@pasen/shared'

export type RoleFilter = DraftRole | 'ALL'

/** The filters every champion grid offers, in lane order. */
export const ROLE_FILTERS: { key: RoleFilter; label: string; icon: string | null }[] = [
  { key: 'ALL', label: 'All', icon: null },
  { key: 'TOP', label: 'Top', icon: 'top' },
  { key: 'JUNGLE', label: 'Jungle', icon: 'jungle' },
  { key: 'MIDDLE', label: 'Mid', icon: 'middle' },
  { key: 'BOTTOM', label: 'Bot', icon: 'bottom' },
  { key: 'UTILITY', label: 'Support', icon: 'utility' },
]

/** Whether a champion with these lanes shows under the filter; a champion plays every lane it lists. */
export function matchesRole(positions: readonly string[] | undefined, filter: RoleFilter): boolean {
  return filter === 'ALL' || (positions ?? []).includes(filter)
}
