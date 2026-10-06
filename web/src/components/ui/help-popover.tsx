import { Button } from '@fohte/ui/button'
import { Popover, PopoverContent } from '@fohte/ui/popover'
import { CircleHelp } from 'lucide-react'
import type { ReactNode } from 'react'
import { useId, useRef, useState } from 'react'

import { cn } from '#lib/utils'

interface HelpPopoverProps {
  label: string
  children: ReactNode
  className?: string | undefined
  tone?: 'default' | 'muted'
  defaultOpen?: boolean
  onOpenChange?: ((open: boolean) => void) | undefined
  tabIndex?: number
}

export function HelpPopover({
  label,
  children,
  className,
  tone = 'default',
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
        className={cn(tone === 'muted' && 'text-muted-foreground', className)}
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
