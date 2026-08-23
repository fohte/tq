import { X } from 'lucide-react'
import { useRef, useState } from 'react'

import { AnchoredPopup } from '#components/ui/anchored-popup'
import {
  BottomSheetHeader,
  BottomSheetPanel,
} from '#components/ui/bottom-sheet'
import { Button } from '#components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
  DialogTrigger,
} from '#components/ui/dialog'
import { useIsDesktop } from '#hooks/use-is-desktop'

interface FilterMenuProps {
  trigger: React.ReactNode
  triggerClassName?: string
  title: string
  children: React.ReactNode
}

// Picks the container only: a popover on desktop, a bottom sheet below the
// `md` breakpoint. Content passed as `children` must work in both, so the
// desktop side uses AnchoredPopup (a plain popover) rather than
// DropdownMenu — Base UI's Menu only wires close-on-select and arrow-key
// navigation into Menu.Item-family children, which plain controls like
// Checkbox or a <button> aren't.
export function FilterMenu({
  trigger,
  triggerClassName,
  title,
  children,
}: FilterMenuProps) {
  const isDesktop = useIsDesktop()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  if (isDesktop) {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          className={triggerClassName}
          onClick={() => {
            setOpen((prev) => !prev)
          }}
        >
          {trigger}
        </button>
        <AnchoredPopup
          anchor={triggerRef}
          open={open}
          onOpenChange={setOpen}
          align="start"
          className="flex w-72 flex-col gap-5 rounded-lg p-2 font-sans shadow-md"
        >
          {children}
        </AnchoredPopup>
      </>
    )
  }

  return (
    <Dialog>
      <DialogTrigger className={triggerClassName}>{trigger}</DialogTrigger>
      <DialogPortal>
        <DialogOverlay />
        <DialogPopup>
          <div className="fixed inset-0 z-50 flex items-end">
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
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
