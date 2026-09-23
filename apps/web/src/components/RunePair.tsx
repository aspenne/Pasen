import type { StaticData } from '@/lib/api'
import { runeIcon } from '@/lib/ddragon'

type Perks = {
  styles?: { style?: number; selections?: { perk?: number }[] }[]
}

/**
 * The keystone and the secondary tree, which is how a build is recognised at a
 * glance - the rest of a rune page rarely changes the answer to "what were they
 * playing".
 *
 * The keystone sits on a dark disc at full size, the secondary tree smaller and
 * overlapping it, the way every client and site draws the pair. Anything we
 * cannot resolve renders as an empty slot rather than a broken image, since a
 * missing rune must not make a scoreboard row jump.
 */
export function RunePair({
  perks,
  staticData,
  size = 22,
}: {
  perks: unknown
  staticData?: StaticData
  size?: number
}) {
  const styles = (perks as Perks | null)?.styles
  const keystoneId = styles?.[0]?.selections?.[0]?.perk
  const secondaryId = styles?.[1]?.style

  // Arena and bot games arrive with every id zeroed; there is nothing to draw.
  if (!keystoneId && !secondaryId) return null

  const keystone = staticData?.runes[String(keystoneId)]
  const secondary = staticData?.runes[String(secondaryId)]
  const small = Math.round(size * 0.62)

  return (
    <span className="flex shrink-0 items-center" aria-hidden={!keystone && !secondary}>
      <span
        className="grid place-items-center rounded-full bg-ground/70"
        style={{ width: size, height: size }}
      >
        {keystone && (
          <img
            src={runeIcon(keystone.image) ?? ''}
            alt={keystone.name}
            title={keystone.name}
            width={size}
            height={size}
          />
        )}
      </span>
      <span
        className="-ml-1 grid place-items-center rounded-full bg-ground/70"
        style={{ width: small, height: small }}
      >
        {secondary && (
          <img
            src={runeIcon(secondary.image) ?? ''}
            alt={secondary.name}
            title={secondary.name}
            width={small}
            height={small}
          />
        )}
      </span>
    </span>
  )
}
