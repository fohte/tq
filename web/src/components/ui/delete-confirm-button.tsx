import { Trash2 } from 'lucide-react'

import { DeleteConfirmDialog } from '#components/ui/delete-confirm-dialog'
import { DialogTrigger } from '#components/ui/dialog'
import { cn } from '#lib/utils'

export function DeleteConfirmButton({
  title,
  description,
  onDelete,
  disabled,
  open,
  iconClassName,
  'aria-label': ariaLabel,
}: {
  title: string
  description: string
  onDelete: () => void
  disabled?: boolean | undefined
  open?: boolean | undefined
  iconClassName?: string | undefined
  'aria-label'?: string | undefined
}) {
  return (
    <DeleteConfirmDialog
      title={title}
      description={description}
      onDelete={onDelete}
      open={open}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            aria-label={ariaLabel}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
          />
        }
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <Trash2 className={cn('size-3.5', iconClassName)} />
      </DialogTrigger>
    </DeleteConfirmDialog>
  )
}
