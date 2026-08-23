import { X } from 'lucide-react'

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu'
import { useIsDesktop } from '#hooks/use-is-desktop'

interface FilterMenuProps {
  trigger: React.ReactNode
  triggerClassName?: string
  title: string
  children: React.ReactNode
}

// Picks the container only: a dropdown on desktop, a bottom sheet below the
// `md` breakpoint. Content passed as `children` must work in both, so it
// can't rely on dropdown-only primitives like DropdownMenuRadioItem.
export function FilterMenu({
  trigger,
  triggerClassName,
  title,
  children,
}: FilterMenuProps) {
  const isDesktop = useIsDesktop()

  if (isDesktop) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className={triggerClassName}>
          {trigger}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <div className="flex flex-col gap-5 p-2">{children}</div>
        </DropdownMenuContent>
      </DropdownMenu>
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
