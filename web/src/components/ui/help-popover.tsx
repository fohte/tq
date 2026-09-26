import { Button } from '@fohte/ui/button'
import { CircleHelp } from 'lucide-react'
import type { ReactNode } from 'react'
import { useId, useRef, useState } from 'react'

import { AnchoredPopup } from '#components/ui/anchored-popup'

interface HelpPopoverProps {
  label: string
  children: ReactNode
  className?: string | undefined
  defaultOpen?: boolean
  onOpenChange?: ((open: boolean) => void) | undefined
  popupClassName?: string
}

export function HelpPopover({
  label,
  children,
  className,
  defaultOpen = false,
  onOpenChange,
  popupClassName,
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
      <AnchoredPopup
        id={popupId}
        open={open}
        onOpenChange={updateOpen}
        anchor={triggerRef}
        align="end"
        className={popupClassName}
      >
        {children}
      </AnchoredPopup>
    </>
  )
}
