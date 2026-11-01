import { sql } from 'drizzle-orm'

import type { DbTransaction } from '#db/connection'
import { tasks } from '#db/schema'
import { type EditAuthor, recordEdit } from '#lib/edits'
import { formatDate } from '#services/recurrence'
import { replaceOccurrenceDateInTitle } from '#services/recurring-task-templates'
import { syncTaskLabels } from '#services/task-labels'

function subtractDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00`)
  date.setDate(date.getDate() - days)
  return formatDate(date)
}

export async function createRecurringTaskOccurrence(
  tx: DbTransaction,
  template: {
    id: string
    title: string
    description: string | null
    startOffsetDays: number | null
    parentId: string | null
    projectId: string | null
    context: 'work' | 'personal'
  },
  occurrenceDate: string,
  labelNames: string[],
  author: EditAuthor,
): Promise<typeof tasks.$inferSelect | null> {
  const [task] = await tx
    .insert(tasks)
    .values({
      title: replaceOccurrenceDateInTitle(template.title, occurrenceDate),
      description: template.description,
      status: 'todo',
      startDate:
        template.startOffsetDays != null
          ? subtractDays(occurrenceDate, template.startOffsetDays)
          : null,
      dueDate: occurrenceDate,
      parentId: template.parentId,
      projectId: template.projectId,
      context: template.context,
      templateId: template.id,
      occurrenceDate,
    })
    .onConflictDoNothing({
      target: [tasks.templateId, tasks.occurrenceDate],
      where: sql`${tasks.templateId} IS NOT NULL`,
    })
    .returning()

  if (!task) return null

  await recordEdit(tx, { taskId: task.id }, { action: 'create' }, author)
  await syncTaskLabels(tx, task.id, labelNames, task.context)
  return task
}
