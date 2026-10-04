import { useEffect, useState } from 'react'

import { RenameSavedViewDialogAppearance } from '#components/saved-view/rename-saved-view-dialog-appearance'
import type { SavedView } from '#hooks/use-saved-views'
import { useRenameSavedView } from '#hooks/use-saved-views'

export function RenameSavedViewDialog({
  view,
  open,
  onOpenChange,
}: {
  view: SavedView
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState(view.name)
  const renameSavedView = useRenameSavedView()

  // Otherwise the input keeps whatever the user typed last time it was open.
  useEffect(() => {
    if (open) setName(view.name)
  }, [open, view.name])

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (!trimmed || renameSavedView.isPending) return
    renameSavedView.mutate(
      { id: view.id, name: trimmed },
      {
        onSuccess: () => {
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <RenameSavedViewDialogAppearance
      open={open}
      onOpenChange={onOpenChange}
      name={name}
      errorMessage={
        renameSavedView.isError ? renameSavedView.error.message : null
      }
      saveDisabled={!name.trim() || renameSavedView.isPending}
      onNameChange={setName}
      onSubmit={handleSubmit}
    />
  )
}
