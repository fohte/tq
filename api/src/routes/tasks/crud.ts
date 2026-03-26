import { db } from '@api/db/connection'
import {
  labels,
  recurrenceRules,
  taskLabels,
  taskPages,
  tasks,
  timeBlocks,
} from '@api/db/schema'
import { firstOrThrow } from '@api/lib/drizzle-utils'
import { pageToResponse } from '@api/routes/task-pages'
import {
  contextEnum,
  requireTask,
  taskStatus,
  taskToResponse,
  timeBlockToResponse,
} from '@api/routes/tasks/shared'
import { recurrenceRuleSchema } from '@api/schemas/recurrence-rule'
import { zValidator } from '@hono/zod-validator'
import { and, count, eq, inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  parentId: z.uuid().optional(),
  projectId: z.uuid().optional(),
  context: contextEnum.optional(),
  labels: z.array(z.string()).optional(),
  recurrenceRule: recurrenceRuleSchema.optional(),
})

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  context: contextEnum.optional(),
  recurrenceRule: recurrenceRuleSchema.nullable().optional(),
})

export const tasksCrudApp = new Hono()
  .post('/', zValidator('json', createTaskSchema), async (c) => {
    const input = c.req.valid('json')

    if (input.parentId != null) {
      const parent = await db.query.tasks.findFirst({
        where: eq(tasks.id, input.parentId),
      })
      if (!parent) {
        return c.json({ error: 'Parent task not found' }, 404)
      }
    }

    // Create recurrence rule if provided
    let recurrenceRuleId: string | null = null
    let createdRule: typeof recurrenceRules.$inferSelect | null = null
    if (input.recurrenceRule != null) {
      const rule = firstOrThrow(
        await db
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
      await db
        .insert(tasks)
        .values({
          title: input.title,
          description: input.description ?? null,
          startDate: input.startDate ?? null,
          dueDate: input.dueDate ?? null,
          estimatedMinutes: input.estimatedMinutes ?? null,
          parentId: input.parentId ?? null,
          projectId: input.projectId ?? null,
          context: input.context ?? 'personal',
          recurrenceRuleId,
        })
        .returning(),
    )

    if (input.labels != null && input.labels.length > 0) {
      const matchedLabels = await db
        .select()
        .from(labels)
        .where(inArray(labels.name, input.labels))

      if (matchedLabels.length > 0) {
        await db.insert(taskLabels).values(
          matchedLabels.map((label) => ({
            taskId: task.id,
            labelId: label.id,
          })),
        )
      }
    }

    return c.json(taskToResponse(task, createdRule), 201)
  })
  .get(
    '/',
    zValidator(
      'query',
      z.object({
        status: taskStatus.optional(),
        projectId: z.uuid().optional(),
        parentId: z.uuid().optional(),
        context: contextEnum.optional(),
      }),
    ),
    async (c) => {
      const query = c.req.valid('query')
      const conditions = []

      if (query.status != null) {
        conditions.push(eq(tasks.status, query.status))
      }
      if (query.projectId != null) {
        conditions.push(eq(tasks.projectId, query.projectId))
      }
      if (query.parentId != null) {
        conditions.push(eq(tasks.parentId, query.parentId))
      }
      if (query.context != null) {
        conditions.push(eq(tasks.context, query.context))
      }

      const result = await db
        .select({
          task: tasks,
          activeTimeBlockStartTime: sql<string | null>`(
          select ${timeBlocks.startTime}
          from ${timeBlocks}
          where ${timeBlocks.taskId} = ${tasks.id}
            and ${timeBlocks.endTime} is null
          order by ${timeBlocks.startTime} desc
          limit 1
        )`.as('active_time_block_start_time'),
        })
        .from(tasks)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(tasks.sortOrder, tasks.createdAt)

      return c.json(
        result.map((r) => ({
          ...taskToResponse(r.task),
          activeTimeBlockStartTime:
            r.activeTimeBlockStartTime != null
              ? new Date(r.activeTimeBlockStartTime).toISOString()
              : null,
        })),
        200,
      )
    },
  )
  .get('/:id', requireTask, async (c) => {
    const task = c.get('task')
    const id = task.id

    const [childStats, pages, taskTimeBlocks, rule] = await Promise.all([
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
    ])

    return c.json(
      {
        ...taskToResponse(task, rule),
        childCompletionCount: {
          total: childStats[0]?.total ?? 0,
          completed: childStats[0]?.completed ?? 0,
        },
        pages: pages.map(pageToResponse),
        timeBlocks: taskTimeBlocks.map(timeBlockToResponse),
      },
      200,
    )
  })
  .patch(
    '/:id',
    requireTask,
    zValidator('json', updateTaskSchema),
    async (c) => {
      const id = c.req.param('id')
      const existing = c.get('task')
      const { recurrenceRule: recurrenceRuleInput, ...taskFields } =
        c.req.valid('json')

      let recurrenceRuleId: string | null | undefined = undefined
      let updatedRule: typeof recurrenceRules.$inferSelect | null = null

      if (recurrenceRuleInput === null) {
        // Remove: check shared references before deleting
        recurrenceRuleId = null
        if (existing.recurrenceRuleId != null) {
          const [otherRef] = await db
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
            await db
              .delete(recurrenceRules)
              .where(eq(recurrenceRules.id, existing.recurrenceRuleId))
          }
        }
      } else if (recurrenceRuleInput !== undefined) {
        if (existing.recurrenceRuleId != null) {
          // Check if shared
          const [otherRef] = await db
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
              await db
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
              await db
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
            await db
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
        await db
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
          (await db.query.recurrenceRules.findFirst({
            where: eq(recurrenceRules.id, updatedTask.recurrenceRuleId),
          })) ?? null
      }

      return c.json(taskToResponse(updatedTask, updatedRule), 200)
    },
  )
  .delete('/:id', requireTask, async (c) => {
    const id = c.req.param('id')
    const existing = c.get('task')

    // Set children's parentId to null before deleting
    await db
      .update(tasks)
      .set({ parentId: null, updatedAt: new Date() })
      .where(eq(tasks.parentId, id))

    await db.delete(tasks).where(eq(tasks.id, id))

    // Clean up orphaned recurrence rule
    if (existing.recurrenceRuleId != null) {
      const [otherRef] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.recurrenceRuleId, existing.recurrenceRuleId))
        .limit(1)
      if (!otherRef) {
        await db
          .delete(recurrenceRules)
          .where(eq(recurrenceRules.id, existing.recurrenceRuleId))
      }
    }

    return c.body(null, 204)
  })
