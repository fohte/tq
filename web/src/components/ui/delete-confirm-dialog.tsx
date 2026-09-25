import type { ReactNode } from 'react'

import { Button } from '#components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#components/ui/dialog'

export function DeleteConfirmDialog({
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
  open,
  onOpenChange,
  children,
}: {
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  open?: boolean | undefined
  onOpenChange?: ((open: boolean) => void) | undefined
  // A DialogTrigger, for callers that open the dialog from their own control
  // instead of driving `open` themselves.
  children?: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <DialogClose
            render={<Button variant="destructive" />}
            onClick={onConfirm}
          >
            {confirmLabel}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
