import { Button } from '@web/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@web/components/ui/dialog'
import { cn } from '@web/lib/utils'
import { Trash2 } from 'lucide-react'

export function DeleteConfirmButton({
  title,
  description,
  onDelete,
  disabled,
  open,
  iconClassName,
}: {
  title: string
  description: string
  onDelete: () => void
  disabled?: boolean | undefined
  open?: boolean | undefined
  iconClassName?: string | undefined
}) {
  return (
    <Dialog open={open}>
      <DialogTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
          />
        }
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <Trash2 className={cn('size-3.5', iconClassName)} />
      </DialogTrigger>
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
