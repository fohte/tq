import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { recurrenceRules, taskFieldValues, tasks } from '#db/schema'
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
import {
  applyTaskFieldValues,
  getTaskFieldValuesByTaskId,
  resolveTaskFieldValues,
} from '#services/task-field-values'
import {
  getOpenGithubBlockerRefsByTaskId,
  GithubBlockerSubjectConflictError,
  lockTaskGithubLinks,
  type PreparedGithubBlockers,
} from '#services/task-github-blockers'
import { syncTaskLabels } from '#services/task-labels'
import { syncTaskLinks } from '#services/task-links'
import {
  lockTaskRelationWrites,
  syncTaskBlockedBy,
} from '#services/task-relations'

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
      fieldValues: fieldValuesInput,
      blockedBy: blockedByInput,
      remindAt: remindAtInput,
      priority: priorityInput,
      ...taskFieldsWithoutPriority
    } = c.req.valid('json')
    const taskFields = {
      ...taskFieldsWithoutPriority,
      ...(priorityInput === undefined ? {} : { priority: priorityInput }),
    }
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

    let blockedByResolution:
      | { targetIds: string[]; githubBlockers: PreparedGithubBlockers }
      | undefined
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
      blockedByResolution = resolveResult
    }

    const existingLabelNames =
      recurrenceRuleInput != null
        ? ((await getLabelNamesByTaskId([id])).get(id) ?? [])
        : []

    const result = await db.transaction(async (tx) => {
      if (blockedByResolution != null || recurrenceRuleInput != null) {
        // project 削除による project_id 更新と FK 参照の競合を避けるため、先に gate を取得する。
        await lockTaskRelationWrites(tx)
      }
      if (blockedByResolution != null) {
        // GitHub link の FK 挿入も task 行をロックするため、同じ advisory lock を先に取る。
        await lockTaskGithubLinks(tx, id)
      }

      const lockedTask = firstOrThrow(
        await tx.select().from(tasks).where(eq(tasks.id, id)).for('update'),
      )
      const effectiveProjectId =
        'projectId' in taskFields
          ? (taskFields.projectId ?? null)
          : lockedTask.projectId
      const resolvedFieldValues =
        fieldValuesInput === undefined
          ? undefined
          : await resolveTaskFieldValues(
              tx,
              effectiveProjectId,
              fieldValuesInput,
            )
      if (resolvedFieldValues != null && 'error' in resolvedFieldValues) {
        return {
          kind: 'invalid-field-values' as const,
          error: resolvedFieldValues.error,
        }
      }

      if (recurrenceRuleInput !== undefined && lockedTask.templateId != null) {
        return {
          kind: 'error' as const,
          body: {
            error: 'Task was concurrently linked to a recurrence template',
          },
          status: 409 as const,
        }
      }

      if (blockedByResolution != null) {
        const syncResult = await syncTaskBlockedBy(
          id,
          blockedByResolution.targetIds,
          blockedByResolution.githubBlockers,
          tx,
        )
        if (syncResult !== 'ok') {
          return { kind: 'blocked-by-error' as const, syncResult }
        }
      }

      const changedFields = diffFields(lockedTask, taskFields, [
        'title',
        'description',
      ])

      let recurrenceRuleId: string | null | undefined = undefined
      let updatedRule: typeof recurrenceRules.$inferSelect | null = null
      let templateFields:
        { templateId: string; occurrenceDate: string } | undefined = undefined
      let firstOccurrenceTitle: string | undefined

      if (recurrenceRuleInput === null) {
        // Remove: check shared references before deleting
        recurrenceRuleId = null
        if (lockedTask.recurrenceRuleId != null) {
          await deleteRecurrenceRuleIfUnreferenced(
            tx,
            lockedTask.recurrenceRuleId,
            id,
          )
        }
      } else if (recurrenceRuleInput !== undefined) {
        // Setting a recurrence rule redirects into the template model: a
        // template owns the rule from here on, and this task becomes its
        // first generated instance instead of owning a rule directly.
        // この要求の変更をロック済みの行に反映し、更新後のタスクから template を作る。
        const effectiveTitle = taskFields.title ?? lockedTask.title
        const effectiveDescription =
          'description' in taskFields
            ? (taskFields.description ?? null)
            : lockedTask.description
        const effectiveContext = taskFields.context ?? lockedTask.context
        const effectiveStartDate =
          'startDate' in taskFields
            ? (taskFields.startDate ?? null)
            : lockedTask.startDate
        const effectiveDueDate =
          'dueDate' in taskFields
            ? (taskFields.dueDate ?? null)
            : lockedTask.dueDate
        const effectiveLabelNames = labelsInput ?? existingLabelNames

        const created = await createTemplateFromTaskFields(
          tx,
          {
            title: effectiveTitle,
            description: effectiveDescription,
            projectId: effectiveProjectId,
            parentId: lockedTask.parentId,
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
        firstOccurrenceTitle = replaceOccurrenceDateInTitle(
          effectiveTitle,
          created.occurrenceDate,
        )

        // A task migrated from before the template model may still own a
        // legacy rule directly; redirecting it into a template must not
        // orphan that rule.
        if (lockedTask.recurrenceRuleId != null) {
          await deleteRecurrenceRuleIfUnreferenced(
            tx,
            lockedTask.recurrenceRuleId,
            id,
          )
        }
      }

      if (effectiveProjectId !== lockedTask.projectId) {
        await tx.delete(taskFieldValues).where(eq(taskFieldValues.taskId, id))
      }

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
      if (resolvedFieldValues != null && 'values' in resolvedFieldValues) {
        await applyTaskFieldValues(
          tx,
          id,
          updatedTask.projectId ?? '',
          resolvedFieldValues.values,
        )
      }
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
    if (result.kind === 'invalid-field-values') {
      return c.json({ error: result.error }, 400)
    }
    if (result.kind === 'blocked-by-error') {
      if (result.syncResult === 'cycle') {
        return c.json({ error: 'Circular blocking relationship detected' }, 409)
      }
      if (result.syncResult === 'github-subject-conflict') {
        return githubLinkErrorResponse(
          c,
          new GithubBlockerSubjectConflictError(),
          'tasks.blocked-by',
        )
      }
      return c.json(
        {
          error:
            'GitHub blockers changed during this update. Retry the request.',
        },
        409,
      )
    }
    const { updatedTask, updatedRule } = result

    const linkSync =
      'description' in taskFields ? await syncTaskLinks(id) : undefined

    const affectedTaskIdsAfter = await getTaskChangeEventIds([id])
    setChangeEventTaskIds(c, [
      ...new Set([...affectedTaskIdsBefore, ...affectedTaskIdsAfter]),
    ])

    const [
      githubLinksByTaskId,
      labelsByTaskId,
      githubBlockerRefsByTaskId,
      fieldValuesByTaskId,
    ] = await Promise.all([
      getGithubLinksByTaskId([id], { role: 'subject' }),
      getLabelNamesByTaskId([id]),
      getOpenGithubBlockerRefsByTaskId([id]),
      getTaskFieldValuesByTaskId([id]),
    ])

    return c.json(
      {
        ...taskToResponse(
          updatedTask,
          updatedRule,
          githubLinksByTaskId.get(id) ?? [],
          labelsByTaskId.get(id) ?? [],
          fieldValuesByTaskId.get(id) ?? [],
        ),
        blockedByGithubRefs: githubBlockerRefsByTaskId.get(id) ?? [],
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
