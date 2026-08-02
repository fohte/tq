import { Button } from '#components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#components/ui/dialog'
import type { SearchResult } from '#hooks/use-search'

export function LinkExistingTaskDialog({
  candidate,
  parentTaskNumber,
  open,
  onOpenChange,
  onConfirm,
}: {
  candidate: SearchResult | null
  parentTaskNumber: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change parent task?</DialogTitle>
          {candidate && (
            <DialogDescription>
              {`#${String(candidate.number)} ${candidate.title} currently belongs to ${
                candidate.parentNumber != null
                  ? `#${String(candidate.parentNumber)}`
                  : 'another task'
              }. It will be moved under #${String(parentTaskNumber)}.`}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
            }}
          >
            Cancel
          </Button>
          <Button onClick={onConfirm}>Move</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
