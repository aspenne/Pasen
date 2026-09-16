import { useQuery } from '@tanstack/react-query'

import { api, type StaticData } from '@/lib/api'

const CDN = 'https://ddragon.leagueoflegends.com/cdn'

/**
 * Artwork is loaded straight from Riot's CDN rather than mirrored: it costs no
 * API budget, no disk, and the browser caches it across sessions.
 */
export function championIcon(version: string | null, slug: string | undefined): string | null {
  return version && slug ? `${CDN}/${version}/img/champion/${slug}.png` : null
}

export function itemIcon(version: string | null, itemId: number): string | null {
  return version && itemId > 0 ? `${CDN}/${version}/img/item/${itemId}.png` : null
}

export function spellIcon(version: string | null, slug: string | undefined): string | null {
  return version && slug ? `${CDN}/${version}/img/spell/${slug}.png` : null
}

export function profileIcon(version: string | null, iconId: number | null): string | null {
  return version && iconId !== null ? `${CDN}/${version}/img/profileicon/${iconId}.png` : null
}

/**
 * Loaded once and kept for the session: ids are stable within a patch, and every
 * screen needs the same lookup.
 */
export function useStaticData() {
  return useQuery<StaticData>({
    queryKey: ['static'],
    queryFn: api.staticData,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })
}
