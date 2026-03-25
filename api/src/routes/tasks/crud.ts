import { db } from '@api/db/connection'
import {
  labels,
  taskLabels,
  taskPages,
  tasks,
  timeBlocks,
} from '@api/db/schema'
import { pageToResponse } from '@api/routes/task-pages'
import {
  contextEnum,
  requireTask,
  taskToResponse,
  timeBlockToResponse,
} from '@api/routes/tasks/shared'
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
  parentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  context: contextEnum.optional(),
  labels: z.array(z.string()).optional(),
})

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  context: contextEnum.optional(),
})

export const tasksCrudApp = new Hono()
  .post('/', zValidator('json', createTaskSchema), async (c) => {
    const input = c.req.valid('json')

    if (input.parentId) {
      const parent = await db.query.tasks.findFirst({
        where: eq(tasks.id, input.parentId),
      })
      if (!parent) {
        return c.json({ error: 'Parent task not found' }, 404)
      }
    }

    const [task] = await db
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
      })
      .returning()

    if (input.labels && input.labels.length > 0) {
      const matchedLabels = await db
        .select()
        .from(labels)
        .where(inArray(labels.name, input.labels))

      if (matchedLabels.length > 0) {
        await db.insert(taskLabels).values(
          matchedLabels.map((label) => ({
            taskId: task!.id,
            labelId: label.id,
          })),
        )
      }
    }

    return c.json(taskToResponse(task!), 201)
  })
  .get(
    '/',
    zValidator(
      'query',
      z.object({
        status: z.enum(['todo', 'in_progress', 'completed']).optional(),
        projectId: z.string().uuid().optional(),
        parentId: z.string().uuid().optional(),
        context: contextEnum.optional(),
      }),
    ),
    async (c) => {
      const query = c.req.valid('query')
      const conditions = []

      if (query.status) {
        conditions.push(eq(tasks.status, query.status))
      }
      if (query.projectId) {
        conditions.push(eq(tasks.projectId, query.projectId))
      }
      if (query.parentId) {
        conditions.push(eq(tasks.parentId, query.parentId))
      }
      if (query.context) {
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
          activeTimeBlockStartTime: r.activeTimeBlockStartTime
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

    const [childStats, pages, taskTimeBlocks] = await Promise.all([
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
    ])

    return c.json(
      {
        ...taskToResponse(task),
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
      const input = c.req.valid('json')

      const [updated] = await db
        .update(tasks)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(tasks.id, id))
        .returning()

      return c.json(taskToResponse(updated!), 200)
    },
  )
  .delete('/:id', requireTask, async (c) => {
    const id = c.req.param('id')

    // Set children's parentId to null before deleting
    await db
      .update(tasks)
      .set({ parentId: null, updatedAt: new Date() })
      .where(eq(tasks.parentId, id))

    await db.delete(tasks).where(eq(tasks.id, id))

    return c.body(null, 204)
  })
