import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { and, eq, isNull } from 'drizzle-orm'
import { ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { recurrenceRules, recurringTaskTemplates, tasks } from '#db/schema'
import { publishChangeEvent } from '#lib/change-events'
import { firstOrThrow } from '#lib/drizzle-utils'
import { recordEdit, SYSTEM_AUTHOR } from '#lib/edits'
import { computeDueOccurrences, formatDate } from '#services/recurrence'
import { getTemplateLabelNames } from '#services/recurring-task-template-labels'
import { syncTaskLabels } from '#services/task-labels'
import { syncTaskLinks } from '#services/task-links'

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() - days)
  return formatDate(d)
}

/**
 * Generate every occurrence a single template has missed, claiming it first
 * so a rolling deploy's two API processes never both generate it.
 */
async function generateForTemplate(
  template: typeof recurringTaskTemplates.$inferSelect,
  today: string,
  onTaskCreated: (taskId: string) => void,
): Promise<void> {
  const rule = await db.query.recurrenceRules.findFirst({
    where: eq(recurrenceRules.id, template.recurrenceRuleId),
  })
  // Defensive guard against a missing recurrence rule row.
  if (!rule) return

  const dueResult = computeDueOccurrences(
    template.lastGeneratedDate ?? template.anchorDate,
    rule,
    today,
  )
  if (dueResult.isErr()) {
    captureWithFingerprint(
      dueResult.error,
      'api.recurring-task-scheduler.compute-due-occurrences-failed',
      { extras: { templateId: template.id } },
    )
    return
  }

  const occurrenceDates = dueResult.value
  const newLastGeneratedDate = occurrenceDates.at(-1)
  if (newLastGeneratedDate == null) return

  // One transaction for the claim and every insert it authorizes: a
  // mid-batch failure rolls back the claim too, so the next tick retries the
  // whole batch from scratch instead of reasoning about a partial batch.
  const createdTaskIds = await db.transaction(async (tx) => {
    // Optimistic lock: only claims if lastGeneratedDate still matches the
    // snapshot read above.
    const claimed = await tx
      .update(recurringTaskTemplates)
      .set({ lastGeneratedDate: newLastGeneratedDate, updatedAt: new Date() })
      .where(
        and(
          eq(recurringTaskTemplates.id, template.id),
          eq(recurringTaskTemplates.enabled, true),
          template.lastGeneratedDate == null
            ? isNull(recurringTaskTemplates.lastGeneratedDate)
            : eq(
                recurringTaskTemplates.lastGeneratedDate,
                template.lastGeneratedDate,
              ),
        ),
      )
      .returning({ id: recurringTaskTemplates.id })
    if (claimed.length === 0) return []

    const labelNames = await getTemplateLabelNames(template.id, tx)

    const ids: string[] = []
    for (const occurrenceDate of occurrenceDates) {
      const created = firstOrThrow(
        await tx
          .insert(tasks)
          .values({
            title: template.title,
            description: template.description,
            status: 'todo',
            startDate:
              template.startOffsetDays != null
                ? subtractDays(occurrenceDate, template.startOffsetDays)
                : null,
            dueDate: occurrenceDate,
            estimatedMinutes: template.estimatedMinutes,
            parentId: template.parentId,
            projectId: template.projectId,
            context: template.context,
            templateId: template.id,
            occurrenceDate,
          })
          .returning(),
      )
      await recordEdit(
        tx,
        { taskId: created.id },
        { action: 'create' },
        SYSTEM_AUTHOR,
      )
      await syncTaskLabels(tx, created.id, labelNames, created.context)
      ids.push(created.id)
    }
    return ids
  })

  for (const id of createdTaskIds) {
    // Must run after the task's transaction commits: syncTaskLinks opens its
    // own transaction and needs the row to already exist.
    await syncTaskLinks(id)
    onTaskCreated(id)
  }
}

/**
 * Generate every task instance due across all enabled templates. Each
 * template runs isolated so one bad template (e.g. a corrupt recurrence
 * rule) never stops the rest from generating.
 */
export async function generateDueRecurringTasks(): Promise<void> {
  const today = formatDate(new Date())

  const templates = await db.query.recurringTaskTemplates.findMany({
    where: eq(recurringTaskTemplates.enabled, true),
  })

  for (const template of templates) {
    const result = await ResultAsync.fromPromise(
      generateForTemplate(template, today, (id) => {
        publishChangeEvent({ resource: 'task', id, origin: null })
      }),
      toError,
    )
    if (result.isErr()) {
      captureWithFingerprint(
        result.error,
        'api.recurring-task-scheduler.template-failed',
        { extras: { templateId: template.id } },
      )
    }
  }
}
