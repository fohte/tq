import { Button } from '@fohte/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'
import { Input } from '@fohte/ui/input'

import { Textarea } from '#components/ui/textarea'

export function TaskWaitFormDialog({
  open,
  onOpenChange,
  body,
  followUpDate,
  onBodyChange,
  onFollowUpDateChange,
  onSubmit,
  isPending = false,
  errorMessage,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  body: string
  followUpDate: string
  onBodyChange: (body: string) => void
  onFollowUpDateChange: (date: string) => void
  onSubmit: () => void
  isPending?: boolean
  errorMessage?: string | undefined
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Wait for</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <Textarea
            aria-label="Wait description"
            autoFocus
            value={body}
            onChange={(event) => {
              onBodyChange(event.target.value)
            }}
            placeholder="What are you waiting for?"
            rows={4}
          />
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-2xs text-muted-foreground-faint">
              FOLLOW UP
            </span>
            <Input
              aria-label="Follow-up date"
              type="date"
              required
              value={followUpDate}
              onChange={(event) => {
                onFollowUpDateChange(event.target.value)
              }}
            />
          </label>
          {errorMessage != null && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || body.trim() === ''}>
              Add
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
