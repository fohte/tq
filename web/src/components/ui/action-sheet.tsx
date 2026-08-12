'use client'

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import * as React from 'react'

import { DialogOverlay, DialogPortal } from '#components/ui/dialog'
import { cn } from '#lib/utils'

function ActionSheet({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="action-sheet" {...props} />
}

function ActionSheetTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="action-sheet-trigger" {...props} />
}

function ActionSheetContent({
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="action-sheet-content"
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card pb-safe duration-100 outline-none data-open:animate-in data-open:slide-in-from-bottom data-open:fade-in-0 data-closed:animate-out data-closed:slide-out-to-bottom data-closed:fade-out-0',
          className,
        )}
        {...props}
      >
        <div className="mx-auto my-2 h-0.5 w-8 bg-muted-foreground-ghost" />
        {children}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

// DialogPrimitive.Close chains its built-in close handler with any `onClick`
// passed through, so an item closes the sheet automatically on select.
function ActionSheetItem({
  className,
  icon,
  children,
  ...props
}: DialogPrimitive.Close.Props & { icon?: React.ReactNode }) {
  return (
    <DialogPrimitive.Close
      data-slot="action-sheet-item"
      className={cn(
        'flex min-h-11 w-full items-center gap-2.5 border-t border-border px-3.5 text-left text-sm text-popover-foreground first:border-t-0',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </DialogPrimitive.Close>
  )
}

export { ActionSheet, ActionSheetContent, ActionSheetItem, ActionSheetTrigger }
