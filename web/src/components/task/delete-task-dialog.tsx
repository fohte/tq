import { DeleteConfirmDialog } from '#components/ui/delete-confirm-dialog'
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
    <DeleteConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete task"
      description={`Are you sure you want to delete #${String(taskNumber)} "${taskTitle}"? Its subtasks are kept and become top-level tasks. This action cannot be undone.`}
      onDelete={handleDelete}
    />
  )
}
