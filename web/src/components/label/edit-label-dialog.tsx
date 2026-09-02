import { useEffect, useState } from 'react'

import {
  contextLabels,
  type ContextValue,
} from '#components/task/create-task-modal-fields'
import { Button } from '#components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#components/ui/dialog'
import { Input } from '#components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'
import type { Label } from '#hooks/use-labels'
import { useUpdateLabel } from '#hooks/use-labels'
import { selectValueHandler } from '#lib/form-utils'

const contextValues = [
  'work',
  'personal',
] as const satisfies readonly ContextValue[]

export function EditLabelDialog({
  label,
  open,
  onOpenChange,
}: {
  label: Label
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState(label.name)
  const [context, setContext] = useState<ContextValue>(label.context)
  const updateLabel = useUpdateLabel()

  // Otherwise the fields keep whatever was typed/selected last time it was open.
  useEffect(() => {
    if (open) {
      setName(label.name)
      setContext(label.context)
    }
  }, [open, label.name, label.context])

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (!trimmed || updateLabel.isPending) return
    updateLabel.mutate(
      { id: label.id, input: { name: trimmed, context } },
      {
        onSuccess: () => {
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit tag</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSubmit()
            }
          }}
        />
        <Select
          value={context}
          onValueChange={selectValueHandler(setContext, contextValues)}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {contextValues.map((value) => (
              <SelectItem key={value} value={value}>
                {contextLabels[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Renaming does not update saved views that filter by this tag name.
        </p>
        {updateLabel.isError && (
          <p className="text-sm text-destructive">
            {updateLabel.error.message}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || updateLabel.isPending}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
