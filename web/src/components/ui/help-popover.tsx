import { Button } from '@fohte/ui/button'
import { Popover, PopoverContent } from '@fohte/ui/popover'
import { CircleHelp } from 'lucide-react'
import type { ReactNode } from 'react'
import { useId, useRef, useState } from 'react'

interface HelpPopoverProps {
  label: string
  children: ReactNode
  className?: string | undefined
  defaultOpen?: boolean
  onOpenChange?: ((open: boolean) => void) | undefined
  tabIndex?: number
}

export function HelpPopover({
  label,
  children,
  className,
  defaultOpen = false,
  onOpenChange,
  tabIndex,
}: HelpPopoverProps) {
  const [open, setOpen] = useState(defaultOpen)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupId = useId()

  const updateOpen = (nextOpen: boolean) => {
    setOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        tabIndex={tabIndex}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        onClick={() => {
          updateOpen(!open)
        }}
        className={className}
      >
        <CircleHelp aria-hidden="true" />
      </Button>
      <Popover anchor={triggerRef} open={open} onOpenChange={updateOpen}>
        <PopoverContent id={popupId} align="end" padding="md">
          {children}
        </PopoverContent>
      </Popover>
    </>
  )
}
