import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { zValidator } from '@hono/zod-validator'
import { and, count, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
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
  getGithubLinksByTaskId,
  getLabelNamesByTaskId,
  hydrateTaskListRows,
  requireTask,
  taskToResponse,
  timeBlockToResponse,
} from '#routes/tasks/shared'
import {
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskSchema,
} from '#schemas/task'
import { getSchedulingSettings } from '#services/scheduling-settings'
import { syncTaskLabels } from '#services/task-labels'
import { getTaskLinks, syncTaskLinks } from '#services/task-links'
import {
  getDuplicateOfNumbersByTaskId,
  getDuplicateOfTask,
} from '#services/task-relations'

export const tasksCrudApp = new Hono()
  .post('/', zValidator('json', createTaskSchema), async (c) => {
    const input = c.req.valid('json')
    const author = c.get('author')

    if (input.parentId != null) {
      const parent = await db.query.tasks.findFirst({
        where: eq(tasks.id, input.parentId),
      })
      if (!parent) {
        return c.json({ error: 'Parent task not found' }, 404)
      }
    }

    const schedulingSettingsResult = await getSchedulingSettings()
    if (schedulingSettingsResult.isErr()) {
      captureWithFingerprint(
        schedulingSettingsResult.error,
        'api.tasks.create-scheduling-settings-failed',
      )
      return c.json({ error: 'Internal server error' }, 500)
    }
    const schedulingSettings = schedulingSettingsResult.value

    const { task, createdRule, labelNames } = await db.transaction(
      async (tx) => {
        // Create recurrence rule if provided
        let recurrenceRuleId: string | null = null
        let createdRule: typeof recurrenceRules.$inferSelect | null = null
        if (input.recurrenceRule != null) {
          const rule = firstOrThrow(
            await tx
              .insert(recurrenceRules)
              .values({
                type: input.recurrenceRule.type,
                interval: input.recurrenceRule.interval,
                daysOfWeek: input.recurrenceRule.daysOfWeek ?? null,
                dayOfMonth: input.recurrenceRule.dayOfMonth ?? null,
              })
              .returning(),
          )
          recurrenceRuleId = rule.id
          createdRule = rule
        }

        const task = firstOrThrow(
          await tx
            .insert(tasks)
            .values({
              title: input.title,
              description: input.description ?? null,
              startDate: input.startDate ?? null,
              dueDate: input.dueDate ?? null,
              estimatedMinutes: input.estimatedMinutes ?? null,
              parentId: input.parentId ?? null,
              projectId: input.projectId ?? null,
              context: input.context ?? schedulingSettings.defaultContext,
              commitment: input.commitment,
              recurrenceRuleId,
            })
            .returning(),
        )

        const labelNames =
          input.labels != null
            ? await syncTaskLabels(tx, task.id, input.labels)
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

    const [
      childStats,
      pages,
      taskTimeBlocks,
      rule,
      githubLinksByTaskId,
      links,
      taskFieldAuthors,
      labelsByTaskId,
      duplicateOfNumbersByTaskId,
      duplicateOfTask,
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
      task.recurrenceRuleId != null
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
        duplicateOfNumber: duplicateOfNumbersByTaskId.get(id) ?? null,
        duplicateOfTask,
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
        ...taskFields
      } = c.req.valid('json')

      const changedFields = diffFields(existing, taskFields, [
        'title',
        'description',
      ])

      const { updatedTask, updatedRule } = await db.transaction(async (tx) => {
        let recurrenceRuleId: string | null | undefined = undefined
        let updatedRule: typeof recurrenceRules.$inferSelect | null = null

        if (recurrenceRuleInput === null) {
          // Remove: check shared references before deleting
          recurrenceRuleId = null
          if (existing.recurrenceRuleId != null) {
            const [otherRef] = await tx
              .select({ id: tasks.id })
              .from(tasks)
              .where(
                and(
                  eq(tasks.recurrenceRuleId, existing.recurrenceRuleId),
                  sql`${tasks.id} != ${id}`,
                ),
              )
              .limit(1)
            if (!otherRef) {
              await tx
                .delete(recurrenceRules)
                .where(eq(recurrenceRules.id, existing.recurrenceRuleId))
            }
          }
        } else if (recurrenceRuleInput !== undefined) {
          if (existing.recurrenceRuleId != null) {
            // Check if shared
            const [otherRef] = await tx
              .select({ id: tasks.id })
              .from(tasks)
              .where(
                and(
                  eq(tasks.recurrenceRuleId, existing.recurrenceRuleId),
                  sql`${tasks.id} != ${id}`,
                ),
              )
              .limit(1)

            if (otherRef) {
              // Shared: create new rule
              const rule = firstOrThrow(
                await tx
                  .insert(recurrenceRules)
                  .values({
                    type: recurrenceRuleInput.type,
                    interval: recurrenceRuleInput.interval,
                    daysOfWeek: recurrenceRuleInput.daysOfWeek ?? null,
                    dayOfMonth: recurrenceRuleInput.dayOfMonth ?? null,
                  })
                  .returning(),
              )
              recurrenceRuleId = rule.id
              updatedRule = rule
            } else {
              // Not shared: update in place
              updatedRule = firstOrThrow(
                await tx
                  .update(recurrenceRules)
                  .set({
                    type: recurrenceRuleInput.type,
                    interval: recurrenceRuleInput.interval,
                    daysOfWeek: recurrenceRuleInput.daysOfWeek ?? null,
                    dayOfMonth: recurrenceRuleInput.dayOfMonth ?? null,
                    updatedAt: new Date(),
                  })
                  .where(eq(recurrenceRules.id, existing.recurrenceRuleId))
                  .returning(),
              )
            }
          } else {
            // Create new rule
            const rule = firstOrThrow(
              await tx
                .insert(recurrenceRules)
                .values({
                  type: recurrenceRuleInput.type,
                  interval: recurrenceRuleInput.interval,
                  daysOfWeek: recurrenceRuleInput.daysOfWeek ?? null,
                  dayOfMonth: recurrenceRuleInput.dayOfMonth ?? null,
                })
                .returning(),
            )
            recurrenceRuleId = rule.id
            updatedRule = rule
          }
        }

        const updatedTask = firstOrThrow(
          await tx
            .update(tasks)
            .set({
              ...taskFields,
              ...(recurrenceRuleId !== undefined ? { recurrenceRuleId } : {}),
              updatedAt: new Date(),
            })
            .where(eq(tasks.id, id))
            .returning(),
        )
        if (updatedRule == null && updatedTask.recurrenceRuleId != null) {
          updatedRule =
            (await tx.query.recurrenceRules.findFirst({
              where: eq(recurrenceRules.id, updatedTask.recurrenceRuleId),
            })) ?? null
        }

        if (labelsInput !== undefined) {
          await syncTaskLabels(tx, id, labelsInput)
        }

        for (const field of changedFields) {
          await recordEdit(
            tx,
            { taskId: id },
            { action: 'update', field },
            author,
          )
        }

        return { updatedTask, updatedRule }
      })

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
        const [otherRef] = await tx
          .select({ id: tasks.id })
          .from(tasks)
          .where(eq(tasks.recurrenceRuleId, existing.recurrenceRuleId))
          .limit(1)
        if (!otherRef) {
          await tx
            .delete(recurrenceRules)
            .where(eq(recurrenceRules.id, existing.recurrenceRuleId))
        }
      }
    })

    return c.body(null, 204)
  })
