import type { ReactNode } from 'react'

import { championSplash, profileIcon } from '@/lib/ddragon'
import type { StaticData } from '@/lib/api'

type PlayerBannerProps = {
  name: string
  subtitle: string
  figure: ReactNode
  figureLabel: string
  profileIconId: number | null
  /** Their most played champion; its splash art becomes the backdrop. */
  championId?: number
  staticData?: StaticData
  accent?: string
  children?: ReactNode
}

/**
 * The banner a player page opens on.
 *
 * The backdrop is the splash art of whatever they play most, which is the
 * cheapest personality the site can buy: the artwork is already on Riot's CDN,
 * costs no API budget, and says who someone is faster than any number. It is
 * heavily darkened and pushed behind a gradient, because the job of the panel
 * is still to be read.
 */
export function PlayerBanner({
  name,
  subtitle,
  figure,
  figureLabel,
  profileIconId,
  championId,
  staticData,
  accent = 'var(--color-accent)',
  children,
}: PlayerBannerProps) {
  const champion = championId ? staticData?.champions[String(championId)] : undefined
  const splash = championSplash(champion?.slug)
  const avatar = profileIcon(staticData?.version ?? null, profileIconId)

  return (
    <section className="relative overflow-hidden rounded-[10px] bg-panel">
      {splash && (
        <img
          src={splash}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover object-[center_22%] opacity-35"
        />
      )}

      {/* Opaque on the left where the text sits, clearing towards the art. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(100deg, #0A0C10F5 0%, #0A0C10E0 34%, #0A0C10A6 62%, #0A0C1066 100%)',
        }}
      />

      <div className="relative flex items-center gap-[18px] px-6 py-[26px]">
        <div
          className="size-[74px] shrink-0 overflow-hidden rounded-[8px] bg-accent-soft"
          style={{ border: `2px solid ${accent}` }}
        >
          {avatar && <img src={avatar} alt="" width={74} height={74} />}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="display truncate text-[26px] font-semibold text-white">{name}</h1>
          <p className="mt-1.5 truncate text-[14px] text-ink-warm">{subtitle}</p>
          {children}
        </div>

        <div className="shrink-0 text-right">
          <div className="display text-[34px] font-bold leading-none" style={{ color: accent }}>
            {figure}
          </div>
          <div className="mt-1.5 text-[13px] text-ink-warm">{figureLabel}</div>
        </div>
      </div>
    </section>
  )
}
