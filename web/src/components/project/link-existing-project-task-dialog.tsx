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

export function LinkExistingProjectTaskDialog({
  candidate,
  currentProjectTitle,
  projectTitle,
  open,
  onOpenChange,
  onConfirm,
}: {
  candidate: SearchResult | null
  currentProjectTitle: string | undefined
  projectTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to this project?</DialogTitle>
          {candidate && (
            <DialogDescription>
              {`#${String(candidate.number)} ${candidate.title} currently belongs to ${
                currentProjectTitle ?? 'another project'
              }. It will be moved to ${projectTitle}.`}
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
