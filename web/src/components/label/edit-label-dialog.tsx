import { Button } from '@fohte/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'
import { Input } from '@fohte/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@fohte/ui/select'
import { useEffect, useState } from 'react'

import {
  contextLabels,
  type ContextValue,
} from '#components/task/create-task-modal-fields'
import type { Label } from '#hooks/use-labels'
import { useUpdateLabel } from '#hooks/use-labels'
import { selectValueHandler } from '#lib/form-utils'

const contextValues = [
  'work',
  'personal',
] as const satisfies readonly ContextValue[]

export function EditLabelDialogAppearance({
  open,
  onOpenChange,
  name,
  context,
  errorMessage,
  saveDisabled,
  onNameChange,
  onContextChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  context: ContextValue
  errorMessage: string | null
  saveDisabled: boolean
  onNameChange: (name: string) => void
  onContextChange: (context: ContextValue) => void
  onSubmit: () => void
}) {
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
            onNameChange(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onSubmit()
            }
          }}
        />
        <Select
          value={context}
          onValueChange={selectValueHandler(onContextChange, contextValues)}
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
        {errorMessage != null && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button onClick={onSubmit} disabled={saveDisabled}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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
    <EditLabelDialogAppearance
      open={open}
      onOpenChange={onOpenChange}
      name={name}
      context={context}
      errorMessage={updateLabel.isError ? updateLabel.error.message : null}
      saveDisabled={!name.trim() || updateLabel.isPending}
      onNameChange={setName}
      onContextChange={setContext}
      onSubmit={handleSubmit}
    />
  )
}
