import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { and, eq, isNull } from 'drizzle-orm'
import { ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { recurrenceRules, recurringTaskTemplates } from '#db/schema'
import { SYSTEM_AUTHOR } from '#lib/edits'
import { computeDueOccurrences, formatDate } from '#services/recurrence'
import {
  afterRecurringTaskOccurrenceCreated,
  createRecurringTaskOccurrence,
} from '#services/recurring-task-occurrences'
import { getTemplateLabelNames } from '#services/recurring-task-template-labels'

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

/**
 * Generate every occurrence a single template has missed, claiming it first
 * so a rolling deploy's two API processes never both generate it.
 */
async function generateForTemplate(
  template: typeof recurringTaskTemplates.$inferSelect,
  today: string,
): Promise<void> {
  const rule = await db.query.recurrenceRules.findFirst({
    where: eq(recurrenceRules.id, template.recurrenceRuleId),
  })
  // Defensive guard against a missing recurrence rule row.
  if (!rule) return

  // An occurrence is generated once its start date arrives, so look ahead by
  // the start offset.
  const horizon = new Date(`${today}T00:00:00`)
  horizon.setDate(horizon.getDate() + (template.startOffsetDays ?? 0))

  const dueResult = computeDueOccurrences(
    template.lastGeneratedDate ?? template.anchorDate,
    rule,
    formatDate(horizon),
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
      const created = await createRecurringTaskOccurrence(
        tx,
        template,
        occurrenceDate,
        labelNames,
        SYSTEM_AUTHOR,
      )
      if (created != null) ids.push(created.id)
    }
    return ids
  })

  for (const id of createdTaskIds) {
    await afterRecurringTaskOccurrenceCreated(id, template.parentId, null)
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
      generateForTemplate(template, today),
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
