type RiotPerks = {
  statPerks?: { offense?: number; flex?: number; defense?: number }
  styles?: { style?: number; selections?: { perk?: number }[] }[]
}

export type RunePage = {
  primary: { style: number; perks: number[] }
  secondary: { style: number; perks: number[] }
  shards: string[]
}

/** Shards have no entry in Data Dragon's rune list, so they go by name. */
const SHARDS: Record<number, string> = {
  5001: 'Health scaling',
  5002: 'Armor',
  5003: 'Magic resist',
  5005: 'Attack speed',
  5007: 'Ability haste',
  5008: 'Adaptive Force',
  5010: 'Move speed',
  5011: 'Health',
  5013: 'Tenacity',
}

/** A match payload's rune page, or null when the game had none to speak of. */
export function runePage(perks: unknown): RunePage | null {
  const page = perks as RiotPerks | null
  const [primary, secondary] = page?.styles ?? []
  if (!primary?.style || !secondary?.style) return null

  const ids = (style: NonNullable<RiotPerks['styles']>[number]) =>
    (style.selections ?? []).map((selection) => selection.perk ?? 0).filter((id) => id > 0)
  const stats = page?.statPerks
  return {
    primary: { style: primary.style, perks: ids(primary) },
    secondary: { style: secondary.style, perks: ids(secondary) },
    shards: [stats?.offense, stats?.flex, stats?.defense]
      .filter((id): id is number => id !== undefined && id > 0)
      .map((id) => SHARDS[id] ?? 'Shard'),
  }
}
