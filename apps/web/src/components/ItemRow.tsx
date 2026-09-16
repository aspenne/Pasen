import { itemIcon } from '@/lib/ddragon'
import type { StaticData } from '@/lib/api'

/** Six slots plus the trinket. Empty slots stay as gaps so the row never reflows. */
export function ItemRow({ items, staticData }: { items: number[]; staticData?: StaticData }) {
  return (
    <div className="flex gap-0.5">
      {items.slice(0, 7).map((itemId, index) => {
        const src = itemIcon(staticData?.version ?? null, itemId)
        return (
          <div key={index} className="size-[18px] rounded-[2px] bg-line">
            {src && <img src={src} alt="" width={18} height={18} loading="lazy" />}
          </div>
        )
      })}
    </div>
  )
}
