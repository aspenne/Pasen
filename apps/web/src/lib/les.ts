const DAY = 86_400_000

/**
 * How far off the LAN is. The board freezes when the LAN day starts; that day
 * says so, and after it the page shows the final standings.
 */
export function countdownLabel(endsAt: string, now: number = Date.now()): string {
  const left = Date.parse(endsAt) - now
  if (left > 0) {
    const days = Math.ceil(left / DAY)
    return `${days} day${days === 1 ? '' : 's'} to go`
  }
  return left > -DAY ? 'LAN day' : 'Final standings'
}

/** Where an account added after the start begins counting. */
export function sinceLabel(since: string): string {
  return `since added on ${new Date(since).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })}`
}
