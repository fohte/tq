import { RecurringTemplateListRow } from '#components/recurring/recurring-template-list-row'
import type { RecurringTemplate } from '#hooks/use-recurring-templates'

export function RecurringTemplateListSection({
  label,
  templates,
}: {
  label: string
  templates: RecurringTemplate[]
}) {
  if (templates.length === 0) return null

  return (
    <div>
      <div className="border-b border-border bg-card px-3.5 py-1.5 font-mono text-2xs tracking-widest text-muted-foreground-faint">
        {label} · {templates.length}
      </div>
      {templates.map((template) => (
        <RecurringTemplateListRow key={template.id} template={template} />
      ))}
    </div>
  )
}
