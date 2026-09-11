import { Link } from '@tanstack/react-router'
import { Repeat } from 'lucide-react'

import { DotSeparatedList } from '#components/ui/dot-separated-list'
import type { RecurringTemplate } from '#hooks/use-recurring-templates'
import { computeNextOccurrence, formatRecurrenceSummary } from '#lib/recurrence'
import { formatShortDate } from '#lib/task-due-date'

function nextOccurrenceLabel(template: RecurringTemplate): string {
  if (!template.enabled) return 'Not generating'

  const next = computeNextOccurrence(
    template.lastGeneratedDate ?? template.anchorDate,
    template.recurrenceRule,
  )
  return next != null ? `Next: ${formatShortDate(next)}` : '—'
}

export function RecurringTemplateListRow({
  template,
}: {
  template: RecurringTemplate
}) {
  return (
    <Link
      to="/recurring/$templateId"
      params={{ templateId: template.id }}
      className="contents"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-3.5 py-3 hover:bg-card">
        <span className="truncate font-mono text-sm font-medium text-foreground">
          {template.title}
        </span>
        <DotSeparatedList
          items={[
            <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs text-muted-foreground">
              <Repeat className="size-3" />
              {formatRecurrenceSummary(template.recurrenceRule)}
            </span>,
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {nextOccurrenceLabel(template)}
            </span>,
          ]}
        />
      </div>
    </Link>
  )
}
