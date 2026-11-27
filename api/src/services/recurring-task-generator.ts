import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { and, eq, isNull } from 'drizzle-orm'
import { ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { recurrenceRules, recurringTaskTemplates } from '#db/schema'
import { SYSTEM_AUTHOR } from '#lib/edits'
import {
  addDays,
  computeDueOccurrences,
  formatDate,
} from '#services/recurrence'
import {
  afterRecurringTaskOccurrenceCreated,
  createRecurringTaskOccurrence,
} from '#services/recurring-task-occurrences'
import { getTemplateLabelNames } from '#services/recurring-task-template-labels'
import { lockTaskRelationWrites } from '#services/task-relations'

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

/**
 * Generate every occurrence a single template has missed, claiming it first
 * so a rolling deploy's two API processes never both generate it.
 */
async function generateForTemplate(
  templateId: string,
  today: string,
): Promise<void> {
  // One transaction for the claim and every insert it authorizes: a
  // mid-batch failure rolls back the claim too, so the next tick retries the
  // whole batch from scratch instead of reasoning about a partial batch.
  const result = await db.transaction(async (tx) => {
    await lockTaskRelationWrites(tx)

    const [template] = await tx
      .select()
      .from(recurringTaskTemplates)
      .where(eq(recurringTaskTemplates.id, templateId))
      .for('update')
    if (template == null || !template.enabled) {
      return { kind: 'skip' as const }
    }

    const [rule] = await tx
      .select()
      .from(recurrenceRules)
      .where(eq(recurrenceRules.id, template.recurrenceRuleId))
    if (rule == null) return { kind: 'skip' as const }

    // occurrence は開始日に生成するため、開始 offset 分だけ先を計算する。
    const dueResult = computeDueOccurrences(
      template.lastGeneratedDate ?? template.anchorDate,
      rule,
      addDays(today, template.startOffsetDays ?? 0),
    )
    if (dueResult.isErr()) {
      return {
        kind: 'invalid-rule' as const,
        error: dueResult.error,
        templateId: template.id,
      }
    }

    const occurrenceDates = dueResult.value
    const newLastGeneratedDate = occurrenceDates.at(-1)
    if (newLastGeneratedDate == null) return { kind: 'skip' as const }

    // lastGeneratedDate が読み込み後に変わっていた場合は claim しない。
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
    if (claimed.length === 0) return { kind: 'skip' as const }

    const labelNames = await getTemplateLabelNames(template.id, tx)

    const taskIds: string[] = []
    for (const occurrenceDate of occurrenceDates) {
      const created = await createRecurringTaskOccurrence(
        tx,
        template,
        occurrenceDate,
        labelNames,
        SYSTEM_AUTHOR,
      )
      if (created != null) taskIds.push(created.id)
    }
    return {
      kind: 'created' as const,
      taskIds,
      parentId: template.parentId,
    }
  })

  if (result.kind === 'invalid-rule') {
    captureWithFingerprint(
      result.error,
      'api.recurring-task-scheduler.compute-due-occurrences-failed',
      { extras: { templateId: result.templateId } },
    )
    return
  }
  if (result.kind === 'skip') return

  for (const id of result.taskIds) {
    await afterRecurringTaskOccurrenceCreated(id, result.parentId, null)
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
    columns: { id: true },
    where: eq(recurringTaskTemplates.enabled, true),
  })

  for (const template of templates) {
    const result = await ResultAsync.fromPromise(
      generateForTemplate(template.id, today),
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
