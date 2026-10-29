import { Popover } from 'radix-ui'
import { useRef, useState } from 'react'

import { RunePair } from '@/components/RunePair'
import type { StaticData } from '@/lib/api'
import { runeIcon } from '@/lib/ddragon'
import { runePage } from '@/lib/runes'

/**
 * The keystone pair on the row, the whole page one hover - or one tap, on a
 * phone - away. A popover rather than a hover card, since a touch screen never
 * hovers and the page has to be reachable there too.
 */
export function RunePageButton({
  perks,
  staticData,
  name,
}: {
  perks: unknown
  staticData?: StaticData
  /** Whose runes, for the button's label. */
  name: string
}) {
  const [open, setOpen] = useState(false)
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null)
  // A mouse opens it by hovering, so its click must not close it again; a finger taps.
  const mouse = useRef(false)
  const page = runePage(perks)
  if (!page) return <RunePair perks={perks} staticData={staticData} size={20} />

  const hover = (next: boolean) => {
    if (closing.current) clearTimeout(closing.current)
    if (next) setOpen(true)
    else closing.current = setTimeout(() => setOpen(false), 120)
  }
  const rune = (id: number, size: number) => {
    const entry = staticData?.runes?.[String(id)]
    const src = runeIcon(entry?.image)
    return (
      <span key={id} className="flex min-w-0 items-center gap-2">
        <span className="grid shrink-0 place-items-center rounded-full bg-ground/70" style={{ width: size, height: size }}>
          {src && <img src={src} alt="" width={size} height={size} />}
        </span>
        <span className="truncate text-[12px] text-ink">{entry?.name ?? 'Rune'}</span>
      </span>
    )
  }
  const tree = (style: number) => staticData?.runes?.[String(style)]?.name ?? ''

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`${name}'s runes`}
        className="tap inline-flex shrink-0 items-center justify-center rounded-full"
        onPointerEnter={(event) => {
          mouse.current = event.pointerType === 'mouse'
          if (mouse.current) hover(true)
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') hover(false)
        }}
        onClick={(event) => {
          event.preventDefault()
          setOpen((wasOpen) => (mouse.current ? true : !wasOpen))
        }}
      >
        <RunePair perks={perks} staticData={staticData} size={20} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={6}
          collisionPadding={12}
          onPointerEnter={(event) => event.pointerType === 'mouse' && hover(true)}
          onPointerLeave={(event) => event.pointerType === 'mouse' && hover(false)}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="z-50 w-[310px] max-w-[calc(100vw-24px)] rounded-[8px] border border-line bg-panel-solid p-3 shadow-lg"
        >
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-[0.13em] text-ink-dim">{tree(page.primary.style)}</div>
              {page.primary.perks.map((id, index) => rune(id, index === 0 ? 26 : 20))}
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-[0.13em] text-ink-dim">{tree(page.secondary.style)}</div>
              {page.secondary.perks.map((id) => rune(id, 20))}
            </div>
          </div>
          {page.shards.length > 0 && (
            <div className="mt-2.5 border-t border-line pt-2 text-[11px] text-ink-muted">{page.shards.join(' · ')}</div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
