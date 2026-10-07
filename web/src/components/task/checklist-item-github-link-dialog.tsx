import { Button } from '@fohte/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'
import { Input } from '@fohte/ui/input'
import { useState } from 'react'

export function ChecklistItemGithubLinkDialog({
  open,
  onOpenChange,
  itemContent,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemContent: string
  onSubmit: (url: string) => void
}) {
  const [url, setUrl] = useState('')

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setUrl('')
    onOpenChange(nextOpen)
  }

  const handleSubmit = () => {
    const trimmedUrl = url.trim()
    if (trimmedUrl === '') return

    onSubmit(trimmedUrl)
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link pull request</DialogTitle>
          <DialogDescription>
            Paste a pull request URL for “{itemContent}”.
          </DialogDescription>
        </DialogHeader>

        <Input
          aria-label="Pull request URL"
          type="url"
          value={url}
          onChange={(event) => {
            setUrl(event.currentTarget.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleSubmit()
            }
          }}
          placeholder="https://github.com/owner/repo/pull/123"
          autoFocus
        />

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              handleOpenChange(false)
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={url.trim() === ''}>
            Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
