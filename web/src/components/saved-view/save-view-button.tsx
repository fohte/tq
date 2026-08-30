import { Bookmark } from 'lucide-react'
import { useState } from 'react'

import { Button } from '#components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#components/ui/dialog'
import { Input } from '#components/ui/input'
import { useCreateSavedView } from '#hooks/use-saved-views'

export function SaveViewButton({ query }: { query: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const createSavedView = useCreateSavedView()

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) setName('')
  }

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (!trimmed || createSavedView.isPending) return
    createSavedView.mutate(
      { name: trimmed, query },
      {
        onSuccess: () => {
          handleOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="shrink-0">
            <Bookmark data-icon="inline-start" />
            Save view
          </Button>
        }
      />
      <DialogContent
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handleSubmit()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Save view</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value)
          }}
          placeholder="View name"
        />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || createSavedView.isPending}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
