import { InfoTip } from '@/components/InfoTip'
import type { StaticData } from '@/lib/api'
import { runeIcon } from '@/lib/ddragon'
import { runePage } from '@/lib/runes'

/**
 * The whole rune page in one line: the keystone, the rest of its tree, the
 * secondary tree, then the shards, each a step smaller. Every one names itself
 * and says what it does on hover.
 */
export function RuneStrip({ perks, staticData }: { perks: unknown; staticData?: StaticData }) {
  const page = runePage(perks)
  // Arena and bot games come without a page.
  if (!page) return null

  const tree = (style: number) => staticData?.runes?.[String(style)]?.name
  const rune = (id: number, size: number, context: string | undefined) => {
    const entry = staticData?.runes?.[String(id)]
    const src = runeIcon(entry?.image)
    return (
      <InfoTip key={id} title={entry?.name ?? 'Rune'} aside={context} text={entry?.description}>
        <span
          className="grid shrink-0 place-items-center rounded-full bg-ground/70"
          style={{ width: size, height: size }}
        >
          {src && <img src={src} alt={entry?.name ?? ''} width={size} height={size} />}
        </span>
      </InfoTip>
    )
  }

  const [keystone, ...primary] = page.primary.perks
  const primaryTree = tree(page.primary.style)
  const secondaryTree = tree(page.secondary.style)

  return (
    <span className="flex shrink-0 items-center gap-2">
      <span className="flex items-center gap-0.5">
        {keystone && rune(keystone, 24, primaryTree && `${primaryTree} keystone`)}
        {primary.map((id) => rune(id, 18, primaryTree))}
      </span>
      <span className="flex items-center gap-0.5">
        {page.secondary.perks.map((id) => rune(id, 18, secondaryTree))}
      </span>
      {page.shards.length > 0 && (
        <span className="flex items-center gap-0.5">
          {page.shards.map((shard, index) => {
            const src = runeIcon(shard.image ?? undefined)
            return (
              <InfoTip key={`${shard.id}-${index}`} title={shard.name} aside="Shard" text={shard.description}>
                <span className="grid size-[14px] shrink-0 place-items-center rounded-full bg-ground/70">
                  {src && <img src={src} alt={shard.name} width={14} height={14} />}
                </span>
              </InfoTip>
            )
          })}
        </span>
      )}
    </span>
  )
}
