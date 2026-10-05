import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import {
  recurrenceRules,
  taskDescriptionTemplates,
  taskRelations,
  tasks,
} from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
import { diffFields, recordEdit } from '#lib/edits'
import { githubLinkErrorResponse } from '#routes/github-link-error'
import {
  resolveCreateBlockedByInputs,
  resolveUpdateBlockedByInputs,
} from '#routes/tasks/blocked-by'
import { tasksDeleteApp } from '#routes/tasks/delete'
import { tasksListApp } from '#routes/tasks/list'
import {
  getGithubLinksByTaskId,
  getLabelNamesByTaskId,
  getRecurrenceRulesByTemplateIds,
  requireTask,
  resolveParentId,
  taskToResponse,
} from '#routes/tasks/shared'
import { createTaskSchema, updateTaskSchema } from '#schemas/task'
import { deleteRecurrenceRuleIfUnreferenced } from '#services/recurrence-rule-cleanup'
import { createTemplateFromTaskFields } from '#services/recurring-task-templates'
import {
  checkTaskCreate,
  checkTaskUpdate,
  resolveTaskCreateTemplate,
  taskConventionViolationBody,
} from '#services/task-conventions'
import {
  GithubBlockerSubjectConflictError,
  insertTaskGithubBlockers,
  type PreparedGithubBlockers,
} from '#services/task-github-blockers'
import { syncTaskLabels } from '#services/task-labels'
import { syncTaskLinks } from '#services/task-links'
import { syncTaskBlockedBy } from '#services/task-relations'

export const tasksCrudApp = new Hono()
  .post('/', zValidator('json', createTaskSchema), async (c) => {
    const input = c.req.valid('json')
    const author = c.get('author')

    const templateSelection = await resolveTaskCreateTemplate(author, {
      template: input.template,
    })
    const conventionViolation = checkTaskCreate(author, {
      template: templateSelection,
      description: input.description,
    })
    if (conventionViolation !== null) {
      return c.json(
        taskConventionViolationBody(conventionViolation, 'creation'),
        400,
      )
    }
    let parentId: string | null = null
    if (input.parentId != null) {
      const resolved = await resolveParentId(input.parentId)
      if ('error' in resolved) {
        return c.json(resolved.error.body, resolved.error.status)
      }
      parentId = resolved.id
    }

    let blockedByTargetIds: string[] = []
    let githubBlockers: PreparedGithubBlockers | undefined
    if (input.blockedBy != null) {
      const resolved = await resolveCreateBlockedByInputs(input.blockedBy)
      if ('error' in resolved) {
        return c.json(resolved.error.body, resolved.error.status)
      }
      if ('githubError' in resolved) {
        return githubLinkErrorResponse(
          c,
          resolved.githubError,
          'tasks.blocked-by',
        )
      }
      blockedByTargetIds = resolved.targetIds
      githubBlockers = resolved.githubBlockers
    }

    const { task, createdRule, labelNames } = await db.transaction(
      async (tx) => {
        let descriptionTemplateId = templateSelection?.selected?.id ?? null
        if (descriptionTemplateId !== null) {
          // Keep deletion from racing between template selection and insertion.
          const [selectedTemplate] = await tx
            .select({ id: taskDescriptionTemplates.id })
            .from(taskDescriptionTemplates)
            .where(eq(taskDescriptionTemplates.id, descriptionTemplateId))
            .for('key share')
          descriptionTemplateId = selectedTemplate?.id ?? null
        }

        // Setting recurrence creates a template and links the task as its first instance.
        let templateFields: {
          templateId: string
          occurrenceDate: string
        } | null = null
        let createdRule: typeof recurrenceRules.$inferSelect | null = null
        if (input.recurrenceRule != null) {
          const created = await createTemplateFromTaskFields(
            tx,
            {
              title: input.title,
              description: input.description ?? null,
              estimatedMinutes: input.estimatedMinutes ?? null,
              projectId: input.projectId ?? null,
              parentId,
              context: input.context ?? 'personal',
              labels: input.labels ?? [],
            },
            {
              type: input.recurrenceRule.type,
              interval: input.recurrenceRule.interval,
              daysOfWeek: input.recurrenceRule.daysOfWeek ?? null,
              dayOfMonth: input.recurrenceRule.dayOfMonth ?? null,
            },
            input.startDate ?? null,
            input.dueDate ?? null,
          )
          createdRule = created.rule
          templateFields = {
            templateId: created.template.id,
            occurrenceDate: created.occurrenceDate,
          }
        }

        const task = firstOrThrow(
          await tx
            .insert(tasks)
            .values({
              title: input.title,
              description: input.description ?? null,
              descriptionTemplateId,
              startDate: input.startDate ?? null,
              dueDate: templateFields?.occurrenceDate ?? input.dueDate ?? null,
              estimatedMinutes: input.estimatedMinutes ?? null,
              parentId,
              projectId: input.projectId ?? null,
              context: input.context,
              commitment: input.commitment,
              templateId: templateFields?.templateId,
              occurrenceDate: templateFields?.occurrenceDate,
            })
            .returning(),
        )

        const labelNames =
          input.labels != null
            ? await syncTaskLabels(tx, task.id, input.labels, task.context)
            : []

        // Inserted directly (not via `syncTaskBlockedBy`) so a blocker
        // deleted between the existence check above and here aborts the
        // whole insert atomically instead of leaving an orphaned task with
        // a missing blocker. A cycle can't happen for a brand-new task, so
        // `syncTaskBlockedBy`'s advisory-lock/cycle check isn't needed here.
        if (blockedByTargetIds.length > 0) {
          await tx.insert(taskRelations).values(
            blockedByTargetIds.map((targetTaskId) => ({
              sourceTaskId: task.id,
              targetTaskId,
              type: 'blocked_by' as const,
            })),
          )
        }
        if (githubBlockers != null) {
          await insertTaskGithubBlockers(tx, task.id, githubBlockers.newIssues)
        }

        await recordEdit(tx, { taskId: task.id }, { action: 'create' }, author)

        return { task, createdRule, labelNames }
      },
    )

    const linkSync = await syncTaskLinks(task.id)

    return c.json(
      {
        ...taskToResponse(task, createdRule, [], labelNames),
        linkSync,
      },
      201,
    )
  })
  .route('/', tasksListApp)
  .patch(
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
          return c.json(
            { error: 'Circular blocking relationship detected' },
            409,
          )
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

      const changedFields = diffFields(existing, taskFields, [
        'title',
        'description',
      ])

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
          const effectiveEstimatedMinutes =
            'estimatedMinutes' in taskFields
              ? (taskFields.estimatedMinutes ?? null)
              : existing.estimatedMinutes
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
              estimatedMinutes: effectiveEstimatedMinutes,
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

        const updatedTask = firstOrThrow(
          await tx
            .update(tasks)
            .set({
              ...taskFields,
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
        } else if (
          updatedRule == null &&
          updatedTask.recurrenceRuleId != null
        ) {
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
          ...(linkSync ? { linkSync } : {}),
        },
        200,
      )
    },
  )
  .route('/', tasksDeleteApp)
