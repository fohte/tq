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
  onDelete,
  open,
  onOpenChange,
  children,
}: {
  title: string
  description: string
  onDelete: () => void
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
            onClick={onDelete}
          >
            Delete
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
