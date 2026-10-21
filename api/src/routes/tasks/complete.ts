import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { recurrenceRules, tasks } from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
import { taskIdOrNumber } from '#lib/numeric-id'
import { recordStatusChanged } from '#lib/task-events'
import {
  checkNotBlocked,
  insertDuplicateOfRelation,
  resolveDuplicateTarget,
} from '#routes/tasks/completion-helpers'
import {
  getLabelNamesByTaskId,
  getRecurrenceRulesByTemplateIds,
  requireTask,
  taskToResponse,
} from '#routes/tasks/shared'
import { taskStatusReason } from '#schemas/task'
import type { DuplicateTaskSummary } from '#schemas/webhook'
import { syncChecklistItemWithSubtaskStatus } from '#services/task-checklist-subtasks'
import {
  checkTaskComplete,
  taskConventionViolationBody,
} from '#services/task-conventions'
import { dispatchTaskStatusChangedWebhook } from '#services/task-status-webhooks'

export const tasksCompleteApp = new Hono().post(
  '/:id/complete',
  requireTask,
  zValidator(
    'json',
    z.object({
      statusReason: taskStatusReason.optional(),
      duplicateOfTaskId: taskIdOrNumber.optional(),
    }),
  ),
  async (c) => {
    const existing = c.get('task')
    const id = existing.id
    const author = c.get('author')
    const { statusReason, duplicateOfTaskId } = c.req.valid('json')
    const reason = statusReason ?? 'completed'
    let duplicateTarget: DuplicateTaskSummary | null = null

    if (reason === 'duplicate' && duplicateOfTaskId != null) {
      const resolvedDuplicateTarget = await resolveDuplicateTarget(
        id,
        duplicateOfTaskId,
      )
      if ('error' in resolvedDuplicateTarget) {
        return c.json(
          resolvedDuplicateTarget.error.body,
          resolvedDuplicateTarget.error.status,
        )
      }
      duplicateTarget = resolvedDuplicateTarget.target
    }

    // `existing.status` was read by requireTask outside this transaction,
    // so the already-completed check must be re-evaluated against a locked,
    // freshly-read row: two concurrent completions of the same task would
    // otherwise both see the stale pre-completion status and both record a
    // status_changed event.
    const result = await db.transaction(async (tx) => {
      const current = firstOrThrow(
        await tx
          .select({
            id: tasks.id,
            status: tasks.status,
            description: tasks.description,
          })
          .from(tasks)
          .where(eq(tasks.id, id))
          .for('update'),
      )

      if (current.status === 'completed') {
        return {
          kind: 'error' as const,
          body: { error: 'Task is already completed' },
          status: 409 as const,
        }
      }

      const conventionViolation = await checkTaskComplete(
        author,
        current,
        reason,
        tx,
      )
      if (conventionViolation !== null) {
        return {
          kind: 'error' as const,
          body: taskConventionViolationBody(conventionViolation, 'completion'),
          status: 400 as const,
        }
      }

      const blockedError = await checkNotBlocked(tx, id)
      if (blockedError) return { kind: 'error' as const, ...blockedError }

      const updatedTask = firstOrThrow(
        await tx
          .update(tasks)
          .set({
            status: 'completed',
            statusReason: reason,
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, id))
          .returning(),
      )

      await recordStatusChanged(
        tx,
        id,
        current.status,
        'completed',
        reason,
        author,
      )
      await syncChecklistItemWithSubtaskStatus(tx, id, 'completed')

      if (duplicateTarget != null) {
        await insertDuplicateOfRelation(tx, id, duplicateTarget.id)
      }

      return {
        kind: 'ok' as const,
        task: updatedTask,
      }
    })

    if (result.kind === 'error') {
      return c.json(result.body, result.status)
    }
    const updatedTask = result.task

    await dispatchTaskStatusChangedWebhook(updatedTask, duplicateTarget)

    let completedTaskRule: typeof recurrenceRules.$inferSelect | null = null
    if (updatedTask.templateId != null) {
      const rulesByTemplateId = await getRecurrenceRulesByTemplateIds([
        updatedTask.templateId,
      ])
      completedTaskRule = rulesByTemplateId.get(updatedTask.templateId) ?? null
    } else if (updatedTask.recurrenceRuleId != null) {
      completedTaskRule =
        (await db.query.recurrenceRules.findFirst({
          where: eq(recurrenceRules.id, updatedTask.recurrenceRuleId),
        })) ?? null
    }

    const labelsByTaskId = await getLabelNamesByTaskId([id])

    return c.json(
      taskToResponse(
        updatedTask,
        completedTaskRule,
        undefined,
        labelsByTaskId.get(id) ?? [],
      ),
      200,
    )
  },
)
