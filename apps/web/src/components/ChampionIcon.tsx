import { championIcon } from '@/lib/ddragon'
import type { StaticData } from '@/lib/api'

type ChampionIconProps = {
  championId: number
  championName: string
  staticData?: StaticData
  size?: number
}

/**
 * Falls back to the champion's initials rather than a broken image: the CDN is
 * third-party, and a missing portrait must not make a row unreadable.
 */
export function ChampionIcon({
  championId,
  championName,
  staticData,
  size = 34,
}: ChampionIconProps) {
  const champion = staticData?.champions[String(championId)]
  const src = championIcon(staticData?.version ?? null, champion?.slug)
  const label = champion?.name ?? championName

  return (
    <div
      className="shrink-0 overflow-hidden rounded-[3px] bg-line-strong"
      style={{ width: size, height: size }}
      title={label}
    >
      {src ? (
        <img src={src} alt={label} width={size} height={size} loading="lazy" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[11px] text-ink-muted">
          {label.slice(0, 2)}
        </span>
      )}
    </div>
  )
}
