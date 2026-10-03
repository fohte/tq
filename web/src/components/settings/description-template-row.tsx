import { Button } from '@fohte/ui/button'

import { DeleteConfirmButton } from '#components/ui/delete-confirm-button'
import type { DescriptionTemplate } from '#hooks/use-description-templates'
import { useDeleteDescriptionTemplate } from '#hooks/use-description-templates'

function getHeadingSummary(body: string) {
  const headings = [...body.matchAll(/^## (.+)$/gm)].flatMap(([, heading]) =>
    heading == null ? [] : [heading.trim()],
  )

  return headings.length > 0
    ? headings.map((heading) => `## ${heading}`).join(' · ')
    : '見出しなし'
}

export interface DescriptionTemplateRowProps {
  template: DescriptionTemplate
  onEdit: () => void
}

export function DescriptionTemplateRow({
  template,
  onEdit,
}: DescriptionTemplateRowProps) {
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

export interface DescriptionTemplateRowViewProps {
  template: DescriptionTemplate
  onEdit: () => void
  onDelete: () => void
  isDeletePending: boolean
  deleteError?: string | undefined
}

export function DescriptionTemplateRowView({
  template,
  onEdit,
  onDelete,
  isDeletePending,
  deleteError,
}: DescriptionTemplateRowViewProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            {template.name}
            {template.isDefault && (
              <span className="border border-border-strong bg-surface-strong px-1.5 font-mono text-2xs text-foreground">
                既定
              </span>
            )}
          </span>
          <span className="truncate font-mono text-xs text-muted-foreground">
            {getHeadingSummary(template.body)}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            編集
          </Button>
          <DeleteConfirmButton
            title="テンプレートを削除"
            description={`「${template.name}」を削除しますか? この操作は取り消せません。`}
            aria-label={`${template.name} を削除`}
            onDelete={onDelete}
            disabled={isDeletePending}
          />
        </div>
      </div>

      {deleteError != null && (
        <p role="alert" className="text-sm text-destructive">
          {deleteError}
        </p>
      )}
    </div>
  )
}
