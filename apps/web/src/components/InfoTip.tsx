import { Tooltip } from 'radix-ui'
import type { ReactNode } from 'react'

/**
 * What a rune or an item does, on hover: a name, a line of context, then the
 * game's own text with its line breaks kept, since stats come one per line.
 */
export function InfoTip({
  title,
  aside,
  text,
  children,
}: {
  title: string
  /** A short line beside the title: the tree, the price. */
  aside?: string
  text?: string | null
  children: ReactNode
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 w-max max-w-[300px] rounded-[8px] border border-line bg-panel-solid px-3 py-2.5 shadow-lg"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[12.5px] text-ink">{title}</span>
            {aside && <span className="tnum shrink-0 text-[11px] text-ink-dim">{aside}</span>}
          </div>
          {text && <p className="mt-1.5 whitespace-pre-line text-[11.5px] leading-[1.45] text-ink-muted">{text}</p>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
