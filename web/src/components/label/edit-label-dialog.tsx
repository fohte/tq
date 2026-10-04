import { useEffect, useState } from 'react'

import { EditLabelDialogAppearance } from '#components/label/edit-label-dialog-appearance'
import type { ContextValue } from '#components/task/create-task-modal-fields'
import type { Label } from '#hooks/use-labels'
import { useUpdateLabel } from '#hooks/use-labels'

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
