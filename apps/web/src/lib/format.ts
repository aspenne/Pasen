/** One hue per person, held across every screen so a colour always means the same human. */
const MEMBER_COLORS = [
  'var(--color-member-1)',
  'var(--color-member-2)',
  'var(--color-member-3)',
  'var(--color-member-4)',
  'var(--color-member-5)',
  'var(--color-member-6)',
  'var(--color-member-7)',
  'var(--color-member-8)',
]

/**
 * Colour follows the person, not their rank in a list, so a filter that hides
 * someone must never repaint everybody else. The roster order is stable, and an
 * explicit accent from the admin always wins.
 */
export function memberColor(accentColor: string | null, rosterIndex: number): string {
  return accentColor ?? MEMBER_COLORS[rosterIndex % MEMBER_COLORS.length]
}

export function duration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

export function kda(kills: number, deaths: number, assists: number): string {
  // A deathless game is a perfect ratio, not a division by zero.
  return (((kills + assists) / Math.max(deaths, 1)) * 1).toFixed(2)
}

export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function clockTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(iso))
}

const QUEUE_LABELS: Record<string, string> = {
  ranked_solo: 'Ranked solo',
  ranked_flex: 'Ranked flex',
  normal: 'Normal',
  aram: 'ARAM',
  arena: 'Arena',
  other: 'Other',
}

export function queueLabel(queueGroup: string): string {
  return QUEUE_LABELS[queueGroup] ?? 'Other'
}

const POSITION_LABELS: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'Bot',
  UTILITY: 'Support',
}

export function positionLabel(position: string | null): string | null {
  return position ? (POSITION_LABELS[position] ?? null) : null
}

const TIERS = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
] as const

/**
 * The CSS colour for a ranked tier. Never the only thing saying which tier this
 * is - Master and Diamond are indistinguishable under protanopia - so always
 * render the tier's name, and usually its crest, alongside it.
 */
export function tierColor(tier: string | null | undefined): string {
  const key = (tier ?? '').toUpperCase()
  return TIERS.includes(key as (typeof TIERS)[number])
    ? `var(--color-tier-${key.toLowerCase()})`
    : 'var(--color-tier-unranked)'
}

/** Riot's own crest art, served as SVG so it stays sharp at any size. */
export function tierCrest(tier: string | null | undefined): string | null {
  const key = (tier ?? '').toUpperCase()
  if (!TIERS.includes(key as (typeof TIERS)[number])) return null
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/${key.toLowerCase()}.svg`
}

/** "Master I · 789 LP", with the apex tiers dropping their meaningless division. */
export function rankLabel(rank: {
  tier: string | null
  rank: string | null
  leaguePoints: number
}): string {
  if (!rank.tier) return 'Unranked'
  const apex = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(rank.tier.toUpperCase())
  const tier = rank.tier.charAt(0) + rank.tier.slice(1).toLowerCase()
  return apex ? `${tier} · ${rank.leaguePoints} LP` : `${tier} ${rank.rank} · ${rank.leaguePoints} LP`
}
