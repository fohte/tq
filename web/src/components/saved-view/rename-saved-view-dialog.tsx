import { useEffect, useState } from 'react'

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
import type { SavedView } from '#hooks/use-saved-views'
import { useRenameSavedView } from '#hooks/use-saved-views'

export function RenameSavedViewDialogAppearance({
  open,
  onOpenChange,
  name,
  errorMessage,
  saveDisabled,
  onNameChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  errorMessage: string | null
  saveDisabled: boolean
  onNameChange: (name: string) => void
  onSubmit: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename view</DialogTitle>
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
