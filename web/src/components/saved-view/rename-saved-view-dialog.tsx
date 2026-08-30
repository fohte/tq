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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename view</DialogTitle>
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
        {renameSavedView.isError && (
          <p className="text-sm text-destructive">
            {renameSavedView.error.message}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || renameSavedView.isPending}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
