type RiotPerks = {
  statPerks?: { offense?: number; flex?: number; defense?: number }
  styles?: { style?: number; selections?: { perk?: number }[] }[]
}

export type RunePage = {
  primary: { style: number; perks: number[] }
  secondary: { style: number; perks: number[] }
  shards: Shard[]
}

export type Shard = {
  id: number
  name: string
  /** Path under Data Dragon's unversioned image root, like a rune's. */
  image: string | null
  /** What it gives, for the tooltip; null where the value has changed over the seasons. */
  description: string | null
}

/**
 * Shards have no entry in Data Dragon's rune list, so their names and values
 * live here. The icons do sit on the CDN, under a path of their own.
 */
const SHARDS: Record<number, Omit<Shard, 'id'>> = {
  5001: { name: 'Health scaling', image: 'StatModsHealthScalingIcon', description: '10-180 Health (based on level)' },
  5002: { name: 'Armor', image: 'StatModsArmorIcon', description: null },
  5003: { name: 'Magic resist', image: 'StatModsMagicResIcon', description: null },
  5005: { name: 'Attack speed', image: 'StatModsAttackSpeedIcon', description: '10% Attack Speed' },
  5007: { name: 'Ability haste', image: 'StatModsCDRScalingIcon', description: '8 Ability Haste' },
  5008: { name: 'Adaptive Force', image: 'StatModsAdaptiveForceIcon', description: '9 Adaptive Force' },
  5010: { name: 'Move speed', image: 'StatModsMovementSpeedIcon', description: '2% Move Speed' },
  5011: { name: 'Health', image: 'StatModsHealthPlusIcon', description: '65 Health' },
  5013: { name: 'Tenacity', image: 'StatModsTenacityIcon', description: '15% Tenacity and Slow Resist' },
}

function shard(id: number): Shard {
  const known = SHARDS[id]
  return known
    ? { id, ...known, image: `perk-images/StatMods/${known.image}.png` }
    : { id, name: 'Shard', image: null, description: null }
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
      .map(shard),
  }
}
