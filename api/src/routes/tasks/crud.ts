import { zValidator } from '@hono/zod-validator'
import { and, count, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'

import { db, type DbTransaction } from '#db/connection'
import { recurrenceRules, taskPages, tasks, timeBlocks } from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
import {
  diffFields,
  getPageAuthors,
  getTaskFieldAuthors,
  recordEdit,
} from '#lib/edits'
import { pageToResponse } from '#routes/task-pages'
import { queryTaskList } from '#routes/tasks/list-query'
import {
  findTasksByIdsOrNumbers,
  getGithubLinksByTaskId,
  getLabelNamesByTaskId,
  getRecurrenceRulesByTemplateIds,
  hydrateTaskListRows,
  requireTask,
  resolveParentId,
  taskToResponse,
  timeBlockToResponse,
} from '#routes/tasks/shared'
import {
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskSchema,
} from '#schemas/task'
import { createTemplateFromTaskFields } from '#services/recurring-task-templates'
import { syncTaskLabels } from '#services/task-labels'
import { getTaskLinks, syncTaskLinks } from '#services/task-links'
import {
  getDuplicateOfNumbersByTaskId,
  getDuplicateOfTask,
  getTaskBlockedByRelations,
  syncTaskBlockedBy,
} from '#services/task-relations'

// Self-reference and existence are cheap, non-racy checks -- the cycle check
// needs the transactional lock in `syncTaskBlockedBy` instead. Self-reference
// is checked first, against the raw input, so it never costs a DB round trip
// and always wins over an existence error when a request combines its own
// id/number with an unrelated missing blocker.
async function resolveBlockedByTargets(
  task: { id: string; number: number },
  blockedBy: string[],
): Promise<
  | { targetIds: string[] }
  | { error: { body: { error: string }; status: 400 | 404 } }
> {
  const uniqueRaw = [...new Set(blockedBy)]
  if (uniqueRaw.length === 0) return { targetIds: [] }

  if (uniqueRaw.includes(task.id) || uniqueRaw.includes(String(task.number))) {
    return {
      error: {
        body: { error: 'A task cannot be blocked by itself' },
        status: 400,
      },
    }
  }

  const resolved = await findTasksByIdsOrNumbers(uniqueRaw)
  const missing = uniqueRaw.filter((raw) => !resolved.has(raw))
  if (missing.length > 0) {
    return {
      error: { body: { error: 'Blocking task not found' }, status: 404 },
    }
  }

  const targetIds = [...new Set([...resolved.values()].map((t) => t.id))]
  return { targetIds }
}

// Deletes `recurrenceRules` row `ruleId` if no other task still references it
// directly, so redirecting or clearing a legacy directly-owned rule doesn't
// leave it orphaned. `excludeTaskId` is the task being updated/deleted itself,
// whose own row may still carry the stale reference at the time of this check.
async function deleteRecurrenceRuleIfUnreferenced(
  tx: DbTransaction,
  ruleId: string,
  excludeTaskId?: string,
) {
  const [otherRef] = await tx
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      excludeTaskId != null
        ? and(
            eq(tasks.recurrenceRuleId, ruleId),
            sql`${tasks.id} != ${excludeTaskId}`,
          )
        : eq(tasks.recurrenceRuleId, ruleId),
    )
    .limit(1)
  if (!otherRef) {
    await tx.delete(recurrenceRules).where(eq(recurrenceRules.id, ruleId))
  }
}

export const tasksCrudApp = new Hono()
  .post('/', zValidator('json', createTaskSchema), async (c) => {
    const input = c.req.valid('json')
    const author = c.get('author')

    let parentId: string | null = null
    if (input.parentId != null) {
      const resolved = await resolveParentId(input.parentId)
      if ('error' in resolved) {
        return c.json(resolved.error.body, resolved.error.status)
      }
      parentId = resolved.id
    }

    const { task, createdRule, labelNames } = await db.transaction(
      async (tx) => {
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
  .get('/', zValidator('query', listTasksQuerySchema), async (c) => {
    const query = c.req.valid('query')
    const { rows, ancestorOnlyIds } = await queryTaskList(query)

    const hydratedRows = await hydrateTaskListRows(rows)

    return c.json(
      hydratedRows.map((item) => ({
        ...item,
        ...(ancestorOnlyIds.has(item.id) ? { ancestorOnly: true } : {}),
      })),
      200,
    )
  })
  .get('/:id', requireTask, async (c) => {
    const task = c.get('task')
    const id = task.id
    const templateId = task.templateId

    const [
      childStats,
      parentTask,
      pages,
      taskTimeBlocks,
      rule,
      githubLinksByTaskId,
      links,
      taskFieldAuthors,
      labelsByTaskId,
      duplicateOfNumbersByTaskId,
      duplicateOfTask,
      blockedByRelations,
    ] = await Promise.all([
      db
        .select({
          total: count(),
          completed: count(
            sql`CASE WHEN ${tasks.status} = 'completed' THEN 1 END`,
          ),
        })
        .from(tasks)
        .where(eq(tasks.parentId, id)),
      task.parentId != null
        ? db.query.tasks.findFirst({
            where: eq(tasks.id, task.parentId),
            columns: { number: true },
          })
        : Promise.resolve(null),
      db
        .select()
        .from(taskPages)
        .where(eq(taskPages.taskId, id))
        .orderBy(taskPages.sortOrder, taskPages.createdAt),
      db
        .select()
        .from(timeBlocks)
        .where(eq(timeBlocks.taskId, id))
        .orderBy(timeBlocks.startTime),
      templateId != null
        ? getRecurrenceRulesByTemplateIds([templateId]).then(
            (rulesByTemplateId) => rulesByTemplateId.get(templateId) ?? null,
          )
        : task.recurrenceRuleId != null
          ? db.query.recurrenceRules.findFirst({
              where: eq(recurrenceRules.id, task.recurrenceRuleId),
            })
          : Promise.resolve(null),
      getGithubLinksByTaskId([id]),
      getTaskLinks(id),
      getTaskFieldAuthors(id),
      getLabelNamesByTaskId([id]),
      getDuplicateOfNumbersByTaskId([id]),
      getDuplicateOfTask(id),
      getTaskBlockedByRelations(id),
    ])

    const pageAuthors = await getPageAuthors(pages.map((page) => page.id))

    return c.json(
      {
        ...taskToResponse(
          task,
          rule,
          githubLinksByTaskId.get(id) ?? [],
          labelsByTaskId.get(id) ?? [],
        ),
        titleAuthor: taskFieldAuthors.title,
        descriptionAuthor: taskFieldAuthors.description,
        parentNumber: parentTask?.number ?? null,
        childCompletionCount: {
          total: childStats[0]?.total ?? 0,
          completed: childStats[0]?.completed ?? 0,
        },
        pages: pages.map((page) =>
          pageToResponse(page, pageAuthors.get(page.id) ?? null),
        ),
        timeBlocks: taskTimeBlocks.map(timeBlockToResponse),
        links,
        labels: labelsByTaskId.get(id) ?? [],
        duplicateOfNumber:
          task.statusReason === 'duplicate'
            ? (duplicateOfNumbersByTaskId.get(id) ?? null)
            : null,
        duplicateOfTask:
          task.statusReason === 'duplicate' ? duplicateOfTask : null,
        blockedBy: blockedByRelations.blockedBy,
        blocking: blockedByRelations.blocking,
      },
      200,
    )
  })
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

      const remindAtUpdate =
        remindAtInput === undefined
          ? {}
          : { remindAt: remindAtInput == null ? null : new Date(remindAtInput) }

      if (blockedByInput != null) {
        const resolveResult = await resolveBlockedByTargets(
          existing,
          blockedByInput.map(String),
        )
        if ('error' in resolveResult) {
          return c.json(resolveResult.error.body, resolveResult.error.status)
        }

        const syncResult = await syncTaskBlockedBy(id, resolveResult.targetIds)
        if (syncResult === 'cycle') {
          return c.json(
            { error: 'Circular blocking relationship detected' },
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
        getGithubLinksByTaskId([id]),
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
  .delete('/:id', requireTask, async (c) => {
    const existing = c.get('task')
    const id = existing.id

    await db.transaction(async (tx) => {
      // Reparent children to the deleted task's parent (or top-level if
      // none) before deleting, so the tree structure above the deleted task
      // is preserved. The parent is re-read from the row here rather than
      // taken from `existing` so a concurrent delete of an ancestor (which
      // takes the same row lock via its own reparent update) can't leave
      // this pointing at an already-deleted parent.
      await tx
        .update(tasks)
        .set({
          parentId: sql`(select ${tasks.parentId} from ${tasks} where ${tasks.id} = ${id})`,
          updatedAt: new Date(),
        })
        .where(eq(tasks.parentId, id))

      await tx.delete(tasks).where(eq(tasks.id, id))

      // Clean up orphaned recurrence rule
      if (existing.recurrenceRuleId != null) {
        await deleteRecurrenceRuleIfUnreferenced(tx, existing.recurrenceRuleId)
      }
    })

    return c.body(null, 204)
  })
