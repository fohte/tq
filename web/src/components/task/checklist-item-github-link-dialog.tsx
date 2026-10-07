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
  errorMessage,
  defaultShowError = false,
  isPending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemContent: string
  errorMessage: string | undefined
  defaultShowError?: boolean | undefined
  isPending: boolean
  onSubmit: (url: string, onSuccess: () => void) => void
}) {
  const [url, setUrl] = useState('')
  const [showError, setShowError] = useState(defaultShowError)

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setUrl('')
      setShowError(false)
    }
    onOpenChange(nextOpen)
  }

  const handleSubmit = () => {
    const trimmedUrl = url.trim()
    if (trimmedUrl === '') return

    setShowError(true)
    onSubmit(trimmedUrl, () => {
      handleOpenChange(false)
    })
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
        {showError && errorMessage != null && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}
        {isPending && (
          <p className="text-sm text-muted-foreground">
            Linking pull request...
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              handleOpenChange(false)
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={url.trim() === '' || isPending}
          >
            Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
