import { itemIcon } from '@/lib/ddragon'
import type { StaticData } from '@/lib/api'

/** Six slots plus the trinket. Empty slots stay as gaps so the row never reflows. */
export function ItemRow({
  items,
  staticData,
  slotClassName = 'size-[26px]',
}: {
  items: number[]
  staticData?: StaticData
  /** The slot's size, for a row that has to shrink on a narrow screen. */
  slotClassName?: string
}) {
  return (
    <div className="flex gap-1">
      {items.slice(0, 7).map((itemId, index) => {
        const src = itemIcon(staticData?.version ?? null, itemId)
        return (
          <div key={index} className={`${slotClassName} shrink-0 rounded-[4px] bg-line-strong/60`}>
            {src && <img src={src} alt="" width={26} height={26} loading="lazy" className="size-full rounded-[4px]" />}
          </div>
        )
      })}
    </div>
  )
}
