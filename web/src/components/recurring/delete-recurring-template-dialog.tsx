import { DeleteConfirmDialog } from '#components/ui/delete-confirm-dialog'
import { useDeleteRecurringTemplate } from '#hooks/use-recurring-templates'

export function DeleteRecurringTemplateDialog({
  open,
  onOpenChange,
  templateId,
  templateTitle,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateId: string
  templateTitle: string
  onDeleted?: (() => void) | undefined
}) {
  const deleteTemplate = useDeleteRecurringTemplate()

  const handleDelete = () => {
    deleteTemplate.mutate(templateId, {
      onSuccess: () => {
        onDeleted?.()
      },
    })
  }

  return (
    <DeleteConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete template"
      description={`Are you sure you want to delete "${templateTitle}"? Tasks it already generated are kept. This action cannot be undone.`}
      onDelete={handleDelete}
    />
  )
}
