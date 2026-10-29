import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { recurrenceRules, tasks } from '#db/schema'
import { setChangeEventTaskIds } from '#lib/change-events'
import { firstOrThrow } from '#lib/drizzle-utils'
import { diffFields, recordEdit } from '#lib/edits'
import { githubLinkErrorResponse } from '#routes/github-link-error'
import { resolveUpdateBlockedByInputs } from '#routes/tasks/blocked-by'
import { getTaskChangeEventIds } from '#routes/tasks/change-event-task-ids'
import { toTaskLinkSyncResponse } from '#routes/tasks/link-sync-response'
import {
  getGithubLinksByTaskId,
  getLabelNamesByTaskId,
  getRecurrenceRulesByTemplateIds,
  requireTask,
  taskToResponse,
} from '#routes/tasks/shared'
import { updateTaskSchema } from '#schemas/task'
import { deleteRecurrenceRuleIfUnreferenced } from '#services/recurrence-rule-cleanup'
import {
  createTemplateFromTaskFields,
  replaceOccurrenceDateInTitle,
} from '#services/recurring-task-templates'
import {
  checkTaskUpdate,
  taskConventionViolationBody,
} from '#services/task-conventions'
import { GithubBlockerSubjectConflictError } from '#services/task-github-blockers'
import { syncTaskLabels } from '#services/task-labels'
import { syncTaskLinks } from '#services/task-links'
import { syncTaskBlockedBy } from '#services/task-relations'

export const tasksUpdateApp = new Hono().patch(
  '/:id',
  requireTask,
  zValidator('json', updateTaskSchema),
  async (c) => {
    const existing = c.get('task')
    const author = c.get('author')
    const id = existing.id
    const {
      recurrenceRule: recurrenceRuleInput,
      labels: labelsInput,
      blockedBy: blockedByInput,
      remindAt: remindAtInput,
      ...taskFields
    } = c.req.valid('json')
    const affectedTaskIdsBefore = await getTaskChangeEventIds([id])

    if (recurrenceRuleInput !== undefined && existing.templateId != null) {
      return c.json(
        {
          error: 'Cannot edit recurrence on a task generated from a template',
        },
        400,
      )
    }

    const conventionViolation = await checkTaskUpdate(
      author,
      existing,
      'description' in taskFields
        ? { description: taskFields.description }
        : {},
    )
    if (conventionViolation !== null) {
      return c.json(
        taskConventionViolationBody(conventionViolation, 'update'),
        400,
      )
    }

    const remindAtUpdate =
      remindAtInput === undefined
        ? {}
        : { remindAt: remindAtInput == null ? null : new Date(remindAtInput) }

    if (blockedByInput != null) {
      const resolveResult = await resolveUpdateBlockedByInputs(
        existing,
        blockedByInput,
      )
      if ('error' in resolveResult) {
        return c.json(resolveResult.error.body, resolveResult.error.status)
      }
      if ('githubError' in resolveResult) {
        return githubLinkErrorResponse(
          c,
          resolveResult.githubError,
          'tasks.blocked-by',
        )
      }

      const syncResult = await syncTaskBlockedBy(
        id,
        resolveResult.targetIds,
        resolveResult.githubBlockers,
      )
      if (syncResult === 'cycle') {
        return c.json({ error: 'Circular blocking relationship detected' }, 409)
      }
      if (syncResult === 'github-subject-conflict') {
        return githubLinkErrorResponse(
          c,
          new GithubBlockerSubjectConflictError(),
          'tasks.blocked-by',
        )
      }
      if (syncResult === 'github-stale-blocker') {
        return c.json(
          {
            error:
              'GitHub blockers changed during this update. Retry the request.',
          },
          409,
        )
      }
    }

    const existingLabelNames =
      recurrenceRuleInput != null
        ? ((await getLabelNamesByTaskId([id])).get(id) ?? [])
        : []

    const result = await db.transaction(async (tx) => {
      let recurrenceRuleId: string | null | undefined = undefined
      let updatedRule: typeof recurrenceRules.$inferSelect | null = null
      let templateFields:
        { templateId: string; occurrenceDate: string } | undefined = undefined

      if (recurrenceRuleInput === null) {
        // Remove: check shared references before deleting
        recurrenceRuleId = null
        if (existing.recurrenceRuleId != null) {
          await deleteRecurrenceRuleIfUnreferenced(
            tx,
            existing.recurrenceRuleId,
            id,
          )
        }
      } else if (recurrenceRuleInput !== undefined) {
        // A concurrent PATCH may have linked this task to a different
        // template between the initial requireTask read and this lock;
        // re-check templateId under the row lock so only one request
        // creates a template for it.
        const locked = firstOrThrow(
          await tx
            .select({ templateId: tasks.templateId })
            .from(tasks)
            .where(eq(tasks.id, id))
            .for('update'),
        )
        if (locked.templateId != null) {
          return {
            kind: 'error' as const,
            body: {
              error: 'Task was concurrently linked to a recurrence template',
            },
            status: 409 as const,
          }
        }

        // Setting a recurrence rule redirects into the template model: a
        // template owns the rule from here on, and this task becomes its
        // first generated instance instead of owning a rule directly.
        // Merge this same request's field edits over `existing` so the
        // template reflects the effective post-update task, not the
        // pre-PATCH row.
        const effectiveTitle = taskFields.title ?? existing.title
        const effectiveDescription =
          'description' in taskFields
            ? (taskFields.description ?? null)
            : existing.description
        const effectiveProjectId =
          'projectId' in taskFields
            ? (taskFields.projectId ?? null)
            : existing.projectId
        const effectiveContext = taskFields.context ?? existing.context
        const effectiveStartDate =
          'startDate' in taskFields
            ? (taskFields.startDate ?? null)
            : existing.startDate
        const effectiveDueDate =
          'dueDate' in taskFields
            ? (taskFields.dueDate ?? null)
            : existing.dueDate
        const effectiveLabelNames = labelsInput ?? existingLabelNames

        const created = await createTemplateFromTaskFields(
          tx,
          {
            title: effectiveTitle,
            description: effectiveDescription,
            projectId: effectiveProjectId,
            parentId: existing.parentId,
            context: effectiveContext,
            labels: effectiveLabelNames,
          },
          {
            type: recurrenceRuleInput.type,
            interval: recurrenceRuleInput.interval,
            daysOfWeek: recurrenceRuleInput.daysOfWeek ?? null,
            dayOfMonth: recurrenceRuleInput.dayOfMonth ?? null,
          },
          effectiveStartDate,
          effectiveDueDate,
        )
        updatedRule = created.rule
        recurrenceRuleId = null
        templateFields = {
          templateId: created.template.id,
          occurrenceDate: created.occurrenceDate,
        }

        // A task migrated from before the template model may still own a
        // legacy rule directly; redirecting it into a template must not
        // orphan that rule.
        if (existing.recurrenceRuleId != null) {
          await deleteRecurrenceRuleIfUnreferenced(
            tx,
            existing.recurrenceRuleId,
            id,
          )
        }
      }

      const firstOccurrenceTitle =
        templateFields != null
          ? replaceOccurrenceDateInTitle(
              taskFields.title ?? existing.title,
              templateFields.occurrenceDate,
            )
          : undefined
      const changedFields = diffFields(
        existing,
        {
          ...taskFields,
          ...(firstOccurrenceTitle !== undefined
            ? { title: firstOccurrenceTitle }
            : {}),
        },
        ['title', 'description'],
      )

      const updatedTask = firstOrThrow(
        await tx
          .update(tasks)
          .set({
            ...taskFields,
            ...(firstOccurrenceTitle !== undefined
              ? { title: firstOccurrenceTitle }
              : {}),
            ...remindAtUpdate,
            ...(recurrenceRuleId !== undefined ? { recurrenceRuleId } : {}),
            ...(templateFields != null
              ? {
                  templateId: templateFields.templateId,
                  occurrenceDate: templateFields.occurrenceDate,
                  dueDate: templateFields.occurrenceDate,
                }
              : {}),
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, id))
          .returning(),
      )
      if (updatedRule == null && updatedTask.templateId != null) {
        const rulesByTemplateId = await getRecurrenceRulesByTemplateIds([
          updatedTask.templateId,
        ])
        updatedRule = rulesByTemplateId.get(updatedTask.templateId) ?? null
      } else if (updatedRule == null && updatedTask.recurrenceRuleId != null) {
        updatedRule =
          (await tx.query.recurrenceRules.findFirst({
            where: eq(recurrenceRules.id, updatedTask.recurrenceRuleId),
          })) ?? null
      }

      if (labelsInput !== undefined) {
        await syncTaskLabels(tx, id, labelsInput, updatedTask.context)
      }

      for (const field of changedFields) {
        await recordEdit(
          tx,
          { taskId: id },
          { action: 'update', field },
          author,
        )
      }

      return { kind: 'ok' as const, updatedTask, updatedRule }
    })

    if (result.kind === 'error') {
      return c.json(result.body, result.status)
    }
    const { updatedTask, updatedRule } = result

    const linkSync =
      'description' in taskFields ? await syncTaskLinks(id) : undefined

    const affectedTaskIdsAfter = await getTaskChangeEventIds([id])
    setChangeEventTaskIds(c, [
      ...new Set([...affectedTaskIdsBefore, ...affectedTaskIdsAfter]),
    ])

    const [githubLinksByTaskId, labelsByTaskId] = await Promise.all([
      getGithubLinksByTaskId([id], { role: 'subject' }),
      getLabelNamesByTaskId([id]),
    ])

    return c.json(
      {
        ...taskToResponse(
          updatedTask,
          updatedRule,
          githubLinksByTaskId.get(id) ?? [],
          labelsByTaskId.get(id) ?? [],
        ),
        ...(linkSync
          ? {
              linkSync: toTaskLinkSyncResponse(linkSync),
            }
          : {}),
      },
      200,
    )
  },
)
