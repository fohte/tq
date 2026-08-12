import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import * as React from 'react'

import { cn } from '#lib/utils'

function AnchoredPopup({
  open,
  onOpenChange,
  anchor,
  side = 'bottom',
  sideOffset = 4,
  align = 'start',
  alignOffset = 0,
  className,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Root.Props, 'open' | 'onOpenChange'> &
  Pick<
    PopoverPrimitive.Positioner.Props,
    'side' | 'sideOffset' | 'align' | 'alignOffset'
  > & {
    anchor: React.RefObject<Element | null>
  }) {
  // The anchor is positioned via the `anchor` prop instead of
  // `Popover.Trigger`, so Base UI's outside-press dismissal doesn't know
  // about it and would close the popup when the anchor itself is clicked.
  const handleOpenChange: PopoverPrimitive.Root.Props['onOpenChange'] = (
    nextOpen,
    eventDetails,
  ) => {
    const target = eventDetails.event.target
    if (
      !nextOpen &&
      target instanceof Node &&
      anchor.current != null &&
      anchor.current.contains(target)
    ) {
      return
    }
    onOpenChange?.(nextOpen, eventDetails)
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={anchor}
          side={side}
          sideOffset={sideOffset}
          align={align}
          alignOffset={alignOffset}
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup
            data-slot="anchored-popup-content"
            className={cn(
              'w-(--anchor-width) rounded-md border border-border bg-popover py-1 font-mono shadow-md',
              className,
            )}
            {...props}
          />
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export { AnchoredPopup }
