import type { ReactNode } from 'react'

import { championCentered, championSplash, profileIcon } from '@/lib/ddragon'
import type { StaticData } from '@/lib/api'

type PlayerBannerProps = {
  name: string
  subtitle: string
  figure: ReactNode
  /** Names what the figure measures, where that is not obvious. */
  figureCaption?: string
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
  figureCaption,
  figureLabel,
  profileIconId,
  championId,
  staticData,
  accent = 'var(--color-accent)',
  children,
}: PlayerBannerProps) {
  const champion = championId ? staticData?.champions?.[String(championId)] : undefined
  const splash = championSplash(champion?.slug)
  const centered = championCentered(championId)
  const avatar = profileIcon(staticData?.version ?? null, profileIconId)

  return (
    <section className="relative overflow-hidden rounded-[10px] bg-panel">
      {(centered ?? splash) && (
        <img
          key={championId}
          src={centered ?? splash ?? ''}
          alt=""
          aria-hidden
          onError={(event) => {
            const image = event.currentTarget
            if (image.dataset.fellBack || !splash) return
            image.dataset.fellBack = 'true'
            image.src = splash
          }}
          className="absolute inset-0 size-full object-cover object-[center_28%] opacity-35"
        />
      )}

      {/* Opaque on the left where the text sits, clearing towards the art. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(100deg, #070C17F5 0%, #070C17E0 34%, #070C17A6 62%, #070C1766 100%)',
        }}
      />

      {/*
        The figure block holds its own width, so on a phone the name between it
        and the avatar was squeezed to a single letter - on the page whose whole
        subject is that name. Below `sm` the figure takes a line of its own.
      */}
      <div className="relative flex flex-wrap items-center gap-x-[18px] gap-y-4 px-6 py-[26px]">
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

        <div className="w-full shrink-0 text-right sm:w-auto">
          <div className="display text-[34px] font-bold leading-none" style={{ color: accent }}>
            {figure}
          </div>
          {figureCaption && (
            <div className="mt-1 text-[11px] uppercase tracking-[0.13em] text-ink-warm">
              {figureCaption}
            </div>
          )}
          <div className="mt-1.5 text-[13px] text-ink-warm">{figureLabel}</div>
        </div>
      </div>
    </section>
  )
}
