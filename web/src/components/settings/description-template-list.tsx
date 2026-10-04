import { Button } from '@fohte/ui/button'
import { Plus } from 'lucide-react'
import { useState } from 'react'

import { DescriptionTemplateFormModal } from '#components/settings/description-template-form-modal'
import { DescriptionTemplateRow } from '#components/settings/description-template-row'
import { QueryStateMessage } from '#components/settings/query-state-message'
import { SectionHeading } from '#components/ui/section-heading'
import type { DescriptionTemplate } from '#hooks/use-description-templates'
import { useDescriptionTemplates } from '#hooks/use-description-templates'

type FormTarget = 'create' | DescriptionTemplate | null

export function DescriptionTemplateList() {
  const [formTarget, setFormTarget] = useState<FormTarget>(null)
  const templates = useDescriptionTemplates()
  const editingTemplate =
    typeof formTarget === 'object' && formTarget !== null
      ? formTarget
      : undefined

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SectionHeading level={3}>description templates</SectionHeading>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setFormTarget('create')
          }}
        >
          <Plus className="size-3.5" />
          追加
        </Button>
      </div>

      {templates.isLoading ? (
        <QueryStateMessage status="loading" />
      ) : templates.isSuccess ? (
        templates.data.length > 0 ? (
          <div className="flex flex-col gap-3">
            {templates.data.map((template) => (
              <DescriptionTemplateRow
                key={template.id}
                template={template}
                onEdit={() => {
                  setFormTarget(template)
                }}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            テンプレートはまだありません
          </p>
        )
      ) : (
        <QueryStateMessage
          status="error"
          message="テンプレートの取得に失敗しました"
        />
      )}

      {formTarget !== null && (
        <DescriptionTemplateFormModal
          key={formTarget === 'create' ? 'create' : formTarget.id}
          open
          onOpenChange={(open) => {
            if (!open) setFormTarget(null)
          }}
          {...(editingTemplate == null ? {} : { template: editingTemplate })}
        />
      )}
    </div>
  )
}
