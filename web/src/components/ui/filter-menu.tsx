import { Button } from '@fohte/ui/button'
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
  DialogTrigger,
} from '@fohte/ui/dialog'
import { Popover, PopoverContent } from '@fohte/ui/popover'
import { X } from 'lucide-react'
import { useRef, useState } from 'react'

import {
  BottomSheetHeader,
  BottomSheetOverlay,
  BottomSheetPanel,
} from '#components/ui/bottom-sheet'
import { useIsDesktop } from '#hooks/use-is-desktop'
import { cn } from '#lib/utils'

interface FilterMenuProps {
  trigger: React.ReactNode
  triggerVariant?: 'default' | 'filter-chip'
  triggerAriaLabel?: string | undefined
  title: string
  children: React.ReactNode
  defaultOpen?: boolean | undefined
  onOpenChange?: ((open: boolean) => void) | undefined
}

// Picks the container only: a popover on desktop, a bottom sheet below the
// `md` breakpoint. Content passed as `children` must work in both, so the
// desktop side uses a plain Popover rather than
// DropdownMenu — Base UI's Menu only wires close-on-select and arrow-key
// navigation into Menu.Item-family children, which plain controls like
// Checkbox or a <button> aren't.
export function FilterMenu({
  trigger,
  triggerVariant = 'default',
  triggerAriaLabel,
  title,
  children,
  defaultOpen = false,
  onOpenChange,
}: FilterMenuProps) {
  const isDesktop = useIsDesktop()
  const [open, setOpen] = useState(defaultOpen)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const updateOpen = (nextOpen: boolean) => {
    setOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }
  const triggerClassName = cn(
    triggerVariant === 'filter-chip' &&
      'inline-flex h-5 min-w-0 cursor-pointer items-center gap-1 font-mono text-xs outline-none hover:opacity-80 focus-visible:underline',
  )

  if (isDesktop) {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          className={triggerClassName}
          aria-label={triggerAriaLabel}
          onClick={() => {
            // Base UI may report this press as an outside dismissal too.
            updateOpen(!open)
          }}
        >
          {trigger}
        </button>
        <Popover anchor={triggerRef} open={open} onOpenChange={updateOpen}>
          <PopoverContent
            align="start"
            padding="md"
            className="flex w-72 flex-col gap-5"
          >
            {children}
          </PopoverContent>
        </Popover>
      </>
    )
  }

  return (
    <Dialog open={open} onOpenChange={updateOpen}>
      <DialogTrigger className={triggerClassName} aria-label={triggerAriaLabel}>
        {trigger}
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay />
        <DialogPopup>
          <BottomSheetOverlay>
            <BottomSheetPanel>
              <BottomSheetHeader>
                <span className="text-base font-semibold text-foreground">
                  {title}
                </span>
                <DialogClose render={<Button variant="ghost" size="icon-sm" />}>
                  <X className="size-5" />
                  <span className="sr-only">Close</span>
                </DialogClose>
              </BottomSheetHeader>
              <div className="flex flex-col gap-5 px-4 pt-4">{children}</div>
            </BottomSheetPanel>
          </BottomSheetOverlay>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
