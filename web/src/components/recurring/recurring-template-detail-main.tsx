import { Link, useNavigate } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'

import { DeleteRecurringTemplateDialog } from '#components/recurring/delete-recurring-template-dialog'
import { GeneratedTasksList } from '#components/recurring/generated-tasks-list'
import { ActionsMenu } from '#components/ui/actions-menu'
import { Chip } from '#components/ui/chip'
import type { RecurringTemplate } from '#hooks/use-recurring-templates'

export function RecurringTemplateMainContent({
  template,
}: {
  template: RecurringTemplate
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <RecurringTemplateBreadcrumb template={template} />

      <h1 className="text-2xl font-bold text-foreground">{template.title}</h1>

      <div className="flex flex-wrap gap-2">
        {template.labels.map((label) => (
          <Chip key={label}>#{label}</Chip>
        ))}
        <Chip>{template.context}</Chip>
      </div>

      {template.description != null && template.description !== '' && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {template.description}
        </p>
      )}

      <div className="border-t border-border" />

      <GeneratedTasksList templateId={template.id} />
    </div>
  )
}

// --- Breadcrumb ---

function RecurringTemplateBreadcrumb({
  template,
}: {
  template: RecurringTemplate
}) {
  const navigate = useNavigate()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  return (
    <nav className="flex items-center gap-2 font-mono text-2xs text-muted-foreground">
      <Link to="/tasks" className="hover:text-foreground">
        tasks
      </Link>
      <span className="text-muted-foreground-ghost">/</span>
      <Link to="/recurring" className="hover:text-foreground">
        recurring
      </Link>
      <span className="text-muted-foreground-ghost">/</span>
      <span className="text-foreground">{template.title}</span>
      <span className="ml-auto">
        <ActionsMenu
          aria-label="Template actions"
          items={[
            {
              icon: <Trash2 className="h-4 w-4" />,
              label: 'delete…',
              onClick: () => {
                setDeleteDialogOpen(true)
              },
              destructive: true,
            },
          ]}
        />
      </span>
      <DeleteRecurringTemplateDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        templateId={template.id}
        templateTitle={template.title}
        onDeleted={() => {
          void navigate({ to: '/recurring' })
        }}
      />
    </nav>
  )
}
