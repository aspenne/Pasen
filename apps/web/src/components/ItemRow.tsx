import { itemIcon } from '@/lib/ddragon'
import type { StaticData } from '@/lib/api'

/** Six slots plus the trinket. Empty slots stay as gaps so the row never reflows. */
export function ItemRow({ items, staticData }: { items: number[]; staticData?: StaticData }) {
  return (
    <div className="flex gap-1">
      {items.slice(0, 7).map((itemId, index) => {
        const src = itemIcon(staticData?.version ?? null, itemId)
        return (
          <div key={index} className="size-[26px] rounded-[4px] bg-line-strong/60">
            {src && <img src={src} alt="" width={26} height={26} loading="lazy" className="rounded-[4px]" />}
          </div>
        )
      })}
    </div>
  )
}
