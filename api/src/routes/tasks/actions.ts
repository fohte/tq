import { zValidator } from '@hono/zod-validator'
import { eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { tasks } from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
import { taskIdOrNumber } from '#lib/numeric-id'
import { recordStatusChanged } from '#lib/task-events'
import { tasksCompleteApp } from '#routes/tasks/complete'
import {
  checkNotBlocked,
  insertDuplicateOfRelation,
  resolveDuplicateTarget,
} from '#routes/tasks/completion-helpers'
import {
  getLabelNamesByTaskId,
  requireTask,
  resolveParentId,
  taskToResponse,
} from '#routes/tasks/shared'
import { taskStatus, taskStatusReason } from '#schemas/task'
import type { DuplicateTaskSummary } from '#schemas/webhook'
import { syncChecklistItemWithSubtaskStatus } from '#services/task-checklist-subtasks'
import {
  checkTaskComplete,
  isLlmCompletionReasonMissing,
  taskConventionViolationBody,
  taskStatusReasonRequiredMessage,
} from '#services/task-conventions'
import { dispatchTaskStatusChangedWebhook } from '#services/task-status-webhooks'

const updateStatusSchema = z.object({
  status: taskStatus,
  statusReason: taskStatusReason.optional(),
  duplicateOfTaskId: taskIdOrNumber.optional(),
})

const updateParentSchema = z.object({
  parentId: taskIdOrNumber.nullable(),
})

export const tasksActionsApp = new Hono()
  .patch(
    '/:id/status',
    requireTask,
    zValidator('json', updateStatusSchema),
    async (c) => {
      const existing = c.get('task')
      const id = existing.id
      const { status, statusReason, duplicateOfTaskId } = c.req.valid('json')
      const author = c.get('author')
      if (
        status === 'completed' &&
        isLlmCompletionReasonMissing(author, statusReason)
      ) {
        return c.json({ error: taskStatusReasonRequiredMessage }, 400)
      }
      const nextStatusReason =
        status === 'completed' ? (statusReason ?? 'completed') : null
      let duplicateTarget: DuplicateTaskSummary | null = null

      if (nextStatusReason === 'duplicate' && duplicateOfTaskId != null) {
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
      // so it can be stale under concurrent requests for the same task.
      // Locking and re-reading here keeps fromStatus accurate for whichever
      // request commits second.
      const result = await db.transaction(async (tx) => {
        const current = firstOrThrow(
          await tx
            .select({
              id: tasks.id,
              status: tasks.status,
              statusReason: tasks.statusReason,
              description: tasks.description,
            })
            .from(tasks)
            .where(eq(tasks.id, id))
            .for('update'),
        )

        if (
          status === 'completed' &&
          (current.status !== 'completed' ||
            current.statusReason !== nextStatusReason)
        ) {
          const conventionViolation = await checkTaskComplete(
            author,
            current,
            nextStatusReason ?? undefined,
            tx,
          )
          if (conventionViolation !== null) {
            return {
              kind: 'error' as const,
              body: taskConventionViolationBody(
                conventionViolation,
                'completion',
              ),
              status: 400 as const,
            }
          }
        }

        if (status === 'completed' && current.status !== 'completed') {
          const blockedError = await checkNotBlocked(tx, id)
          if (blockedError) return { kind: 'error' as const, ...blockedError }
        }

        const updated = firstOrThrow(
          await tx
            .update(tasks)
            .set({
              status,
              statusReason: nextStatusReason,
              updatedAt: new Date(),
            })
            .where(eq(tasks.id, id))
            .returning(),
        )

        if (current.status !== status) {
          await recordStatusChanged(
            tx,
            id,
            current.status,
            status,
            nextStatusReason,
            author,
          )
          await syncChecklistItemWithSubtaskStatus(tx, id, status)
        }

        if (duplicateTarget != null) {
          await insertDuplicateOfRelation(tx, id, duplicateTarget.id)
        }

        return {
          kind: 'ok' as const,
          task: updated,
          statusChanged:
            current.status !== status ||
            current.statusReason !== nextStatusReason,
        }
      })

      if (result.kind === 'error') {
        return c.json(result.body, result.status)
      }
      const updated = result.task

      if (result.statusChanged) {
        await dispatchTaskStatusChangedWebhook(updated, duplicateTarget)
      }

      const labelsByTaskId = await getLabelNamesByTaskId([id])

      return c.json(
        taskToResponse(
          updated,
          undefined,
          undefined,
          labelsByTaskId.get(id) ?? [],
        ),
        200,
      )
    },
  )
  .patch(
    '/:id/parent',
    requireTask,
    zValidator('json', updateParentSchema),
    async (c) => {
      const id = c.get('task').id
      const { parentId: parentIdInput } = c.req.valid('json')

      let parentId: string | null = null
      if (parentIdInput != null) {
        const resolved = await resolveParentId(parentIdInput)
        if ('error' in resolved) {
          return c.json(resolved.error.body, resolved.error.status)
        }

        parentId = resolved.id

        if (parentId === id) {
          return c.json({ error: 'A task cannot be its own parent' }, 409)
        }

        // Check for circular reference by walking ancestors
        const ancestors = await db.execute(sql`
        WITH RECURSIVE ancestors AS (
          SELECT id, parent_id FROM ${tasks} WHERE id = ${parentId}
          UNION ALL
          SELECT t.id, t.parent_id
          FROM ${tasks} t
          INNER JOIN ancestors a ON t.id = a.parent_id
        )
        SELECT id FROM ancestors WHERE id = ${id}
      `)

        const ancestorRows = z
          .array(z.object({ id: z.string() }))
          .parse(ancestors)
        if (ancestorRows.length > 0) {
          return c.json({ error: 'Circular reference detected' }, 409)
        }
      }

      const updated = firstOrThrow(
        await db
          .update(tasks)
          .set({ parentId, updatedAt: new Date() })
          .where(eq(tasks.id, id))
          .returning(),
      )

      const labelsByTaskId = await getLabelNamesByTaskId([id])

      return c.json(
        taskToResponse(
          updated,
          undefined,
          undefined,
          labelsByTaskId.get(id) ?? [],
        ),
        200,
      )
    },
  )
  .route('/', tasksCompleteApp)
