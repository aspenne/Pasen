import { championIcon } from '@/lib/ddragon'
import type { StaticData } from '@/lib/api'

type ChampionIconProps = {
  championId: number
  championName: string
  staticData?: StaticData
  size?: number
  className?: string
}

/**
 * Falls back to the champion's initials rather than a broken image: the CDN is
 * third-party, and a missing portrait must not make a row unreadable.
 */
export function ChampionIcon({
  championId,
  championName,
  staticData,
  size = 48,
  className = '',
}: ChampionIconProps) {
  const champion = staticData?.champions[String(championId)]
  const src = championIcon(staticData?.version ?? null, champion?.slug)
  const label = champion?.name ?? championName

  return (
    <div
      className={`shrink-0 overflow-hidden bg-line-strong ${className}`}
      style={{ width: size, height: size, borderRadius: Math.round(size / 3.2) }}
      title={label}
    >
      {src ? (
        <img src={src} alt={label} width={size} height={size} loading="lazy" />
      ) : (
        <span className="flex size-full items-center justify-center text-[12px] text-ink-muted">
          {label.slice(0, 2)}
        </span>
      )}
    </div>
  )
}
