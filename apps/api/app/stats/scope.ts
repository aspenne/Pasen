import { DEFAULT_SCOPE, QUEUE_SCOPES, groupsInScope, type QueueScope } from '@pasen/shared'

export { DEFAULT_SCOPE }
export type { QueueScope }

/**
 * Narrows a query to the queues a scope covers.
 *
 * Every stats surface takes the same parameter, because a win rate that mixes
 * Arena into Summoner's Rift describes neither: eighteen players against ten,
 * no lanes, no CS, and assist counts that make a KDA there mean something
 * entirely different.
 */
export function applyScope(
  query: { whereIn: (column: string, values: string[]) => unknown },
  scope: QueueScope,
  column = 'm.queue_group'
): void {
  const groups = groupsInScope(scope)

  // null means every queue: no clause at all, rather than a list that would
  // silently exclude any group added later.
  if (groups) {
    query.whereIn(column, groups)
  }
}

/** Falls back to the default rather than throwing on an unknown value. */
export function parseScope(value: unknown): QueueScope {
  return QUEUE_SCOPES.includes(value as QueueScope) ? (value as QueueScope) : DEFAULT_SCOPE
}
