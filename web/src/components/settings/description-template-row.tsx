import { DescriptionTemplateRowView } from '#components/settings/description-template-row-view'
import type { DescriptionTemplate } from '#hooks/use-description-templates'
import { useDeleteDescriptionTemplate } from '#hooks/use-description-templates'

interface Props {
  template: DescriptionTemplate
  onEdit: () => void
}

export function DescriptionTemplateRow({ template, onEdit }: Props) {
  const deleteTemplate = useDeleteDescriptionTemplate()

  return (
    <DescriptionTemplateRowView
      template={template}
      onEdit={onEdit}
      onDelete={() => {
        deleteTemplate.mutate(template.name)
      }}
      isDeletePending={deleteTemplate.isPending}
      deleteError={
        deleteTemplate.isError ? 'テンプレートの削除に失敗しました' : undefined
      }
    />
  )
}
