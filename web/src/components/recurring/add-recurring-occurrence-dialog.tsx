import { Button } from '@fohte/ui/button'
import {
  Dialog,
  DialogHeaderBar,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '@fohte/ui/dialog'
import { Input } from '@fohte/ui/input'
import { X } from 'lucide-react'

import { ModalPanel } from '#components/ui/modal-panel'

interface AddRecurringOccurrenceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  occurrenceDate: string
  onOccurrenceDateChange: (date: string) => void
  isPending: boolean
  error: string | null
  onSubmit: () => void
}

export function AddRecurringOccurrenceDialog({
  open,
  onOpenChange,
  occurrenceDate,
  onOccurrenceDateChange,
  isPending,
  error,
  onSubmit,
}: AddRecurringOccurrenceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPopup>
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-8 max-md:p-0">
            <ModalPanel className="max-w-lg max-md:h-full max-md:max-w-none">
              <DialogHeaderBar>
                <DialogTitle>Add a task from this template</DialogTitle>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    onOpenChange(false)
                  }}
                >
                  <X />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogHeaderBar>

              <form
                className="flex min-h-0 flex-1 flex-col"
                onSubmit={(event) => {
                  event.preventDefault()
                  onSubmit()
                }}
              >
                <div className="flex flex-col gap-3 p-6">
                  <label
                    htmlFor="recurring-occurrence-date"
                    className="font-mono text-xs text-muted-foreground"
                  >
                    Occurrence date
                  </label>
                  <Input
                    id="recurring-occurrence-date"
                    aria-label="Occurrence date"
                    type="date"
                    value={occurrenceDate}
                    disabled={isPending}
                    onChange={(event) => {
                      onOccurrenceDateChange(event.target.value)
                    }}
                    autoFocus
                  />
                  {error != null && (
                    <p role="alert" className="text-xs text-destructive">
                      {error}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isPending || occurrenceDate === ''}
                  >
                    Add
                  </Button>
                </div>
              </form>
            </ModalPanel>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
