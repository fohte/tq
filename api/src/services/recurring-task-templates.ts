import type { DbTransaction } from '#db/connection'
import { recurrenceRules, recurringTaskTemplates } from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
import { formatDate, type RecurrenceRuleInput } from '#services/recurrence'
import { syncTemplateLabels } from '#services/recurring-task-template-labels'

export interface TemplateSourceFields {
  title: string
  description: string | null
  estimatedMinutes: number | null
  projectId: string | null
  parentId: string | null
  context: 'work' | 'personal'
  labels: string[]
}

// Whole calendar days between two 'YYYY-MM-DD' dates, clamped to >= 0 to
// satisfy the DB's `start_offset_days >= 0` check (a start date after the
// due date has no valid offset).
function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = new Date(fromDateStr + 'T00:00:00')
  const to = new Date(toDateStr + 'T00:00:00')
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000)
  return Math.max(days, 0)
}

/**
 * Creates a recurring task template (and the recurrence rule it owns) seeded
 * from a task's fields, for the "set recurrence on a task" pathway (task
 * create/update) to redirect into the template model instead of setting
 * `recurrenceRuleId` directly on the task.
 */
export async function createTemplateFromTaskFields(
  tx: DbTransaction,
  fields: TemplateSourceFields,
  recurrenceRule: RecurrenceRuleInput,
  startDate: string | null,
  dueDate: string | null,
): Promise<{
  template: typeof recurringTaskTemplates.$inferSelect
  rule: typeof recurrenceRules.$inferSelect
  occurrenceDate: string
}> {
  const occurrenceDate = dueDate ?? formatDate(new Date())
  const startOffsetDays =
    startDate != null && dueDate != null
      ? daysBetween(startDate, dueDate)
      : null

  const rule = firstOrThrow(
    await tx
      .insert(recurrenceRules)
      .values({
        type: recurrenceRule.type,
        interval: recurrenceRule.interval,
        daysOfWeek: recurrenceRule.daysOfWeek ?? null,
        dayOfMonth: recurrenceRule.dayOfMonth ?? null,
      })
      .returning(),
  )

  const template = firstOrThrow(
    await tx
      .insert(recurringTaskTemplates)
      .values({
        title: fields.title,
        description: fields.description,
        estimatedMinutes: fields.estimatedMinutes,
        projectId: fields.projectId,
        parentId: fields.parentId,
        context: fields.context,
        recurrenceRuleId: rule.id,
        startOffsetDays,
        anchorDate: occurrenceDate,
      })
      .returning(),
  )

  if (fields.labels.length > 0) {
    await syncTemplateLabels(tx, template.id, fields.labels, template.context)
  }

  return { template, rule, occurrenceDate }
}
