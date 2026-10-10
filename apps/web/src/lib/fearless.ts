import type { FearlessBurn } from '@/lib/api'

export type ChampionEntry = { id: number; name: string; slug: string }

/**
 * What a name looks like typed in a hurry during a draft: no case, no accents,
 * no apostrophes or ampersands. "kaisa" is Kai'Sa, "nunu" is Nunu & Willump.
 */
export function foldName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** Alphabetical; with a query, names that start with it come before names that only contain it. */
export function searchChampions(champions: ChampionEntry[], query: string): ChampionEntry[] {
  const sorted = [...champions].sort((a, b) => a.name.localeCompare(b.name, 'en'))
  const wanted = foldName(query)
  if (!wanted) return sorted

  const starts: ChampionEntry[] = []
  const contains: ChampionEntry[] = []
  for (const champion of sorted) {
    const folded = foldName(champion.name)
    // Every word, so "sol" finds Aurelion Sol as readily as "aur" does.
    const words = champion.name.split(/\s+/).map(foldName)
    if (folded.startsWith(wanted) || words.some((word) => word.startsWith(wanted))) starts.push(champion)
    else if (folded.includes(wanted)) contains.push(champion)
  }
  return [...starts, ...contains]
}

/** The one-line answer to "is it free?" once a search narrows down to a single champion. */
export function availability(champion: ChampionEntry, burn: FearlessBurn | undefined): string {
  if (!burn) return `${champion.name} is free`
  if (burn.source === 'manual') return `${champion.name} is burned · burned by hand`
  const plays = burn.by.map((play) => `${play.playerName} in game ${play.gameNumber}`).join(', ')
  return `${champion.name} is burned · played by ${plays}`
}
