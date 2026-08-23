import { Button } from '#components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#components/ui/dialog'
import { useDeleteTask } from '#hooks/use-tasks'

export function DeleteTaskDialog({
  open,
  onOpenChange,
  taskId,
  taskNumber,
  taskTitle,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string
  taskNumber: number
  taskTitle: string
  onDeleted?: (() => void) | undefined
}) {
  const deleteTask = useDeleteTask()

  const handleDelete = () => {
    deleteTask.mutate(taskId, {
      onSuccess: () => {
        onDeleted?.()
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete task</DialogTitle>
          <DialogDescription>
            {`Are you sure you want to delete #${String(taskNumber)} "${taskTitle}"? Its subtasks are kept and become top-level tasks. This action cannot be undone.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <DialogClose
            render={<Button variant="destructive" />}
            onClick={handleDelete}
          >
            Delete
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
