import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { and, eq, isNull } from 'drizzle-orm'
import { ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { recurrenceRules, recurringTaskTemplates, tasks } from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
import { recordEdit, SYSTEM_AUTHOR } from '#lib/edits'
import { computeDueOccurrences, formatDate } from '#services/recurrence'
import { getTemplateLabelNames } from '#services/recurring-task-template-labels'
import { syncTaskLabels } from '#services/task-labels'
import { syncTaskLinks } from '#services/task-links'

// A day-level trigger, not a minute-level one: a template's due occurrences
// never change within a day, so this doesn't need task-reminders.ts's
// reminder-grade precision.
const POLL_INTERVAL_MS = 15 * 60 * 1000

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
): Promise<void> {
  const rule = await db.query.recurrenceRules.findFirst({
    where: eq(recurrenceRules.id, template.recurrenceRuleId),
  })
  // Shouldn't happen -- recurrenceRuleId is .notNull() -- but the FK doesn't
  // guarantee the row survives forever, so this is defensive rather than
  // reported as an error.
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
  // Also covers the empty-occurrences case: `.at(-1)` on `[]` is `undefined`.
  if (newLastGeneratedDate == null) return

  // One transaction for the claim and every insert it authorizes: a
  // mid-batch failure rolls back the claim too, so the next tick retries the
  // whole batch from scratch instead of reasoning about a partial batch.
  const createdTaskIds = await db.transaction(async (tx) => {
    // Compare-and-set on the `lastGeneratedDate` snapshot read above (not a
    // fresh read here): zero rows updated means another process already
    // claimed this template, or it's no longer eligible (disabled/changed)
    // since that snapshot was taken.
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

/**
 * Start polling for due recurring task occurrences. Called from the server
 * entrypoint rather than from `app.ts` so tests never run the ticker.
 */
export function startRecurringTaskScheduler(): NodeJS.Timeout {
  return setInterval(() => {
    void ResultAsync.fromPromise(generateDueRecurringTasks(), toError).match(
      () => undefined,
      (error) => {
        captureWithFingerprint(
          error,
          'api.recurring-task-scheduler.tick-failed',
        )
      },
    )
  }, POLL_INTERVAL_MS)
}
