import { Button } from '@fohte/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'

export function CreateTaskModalDescriptionTemplateConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace description?</DialogTitle>
          <DialogDescription>
            The current description will be replaced with the selected template,
            or cleared if no template is selected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <DialogClose render={<Button />} onClick={onConfirm}>
            Replace
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
