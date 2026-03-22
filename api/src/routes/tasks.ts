import { db } from '@api/db/connection'
import {
  labels,
  recurrenceRules,
  taskLabels,
  taskPages,
  tasks,
  timeBlocks,
} from '@api/db/schema'
import { pageToResponse } from '@api/routes/task-pages'
import { recurrenceRuleSchema } from '@api/schemas/recurrence-rule'
import { buildNextTaskData } from '@api/services/recurrence'
import { zValidator } from '@hono/zod-validator'
import { and, count, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { createFactory } from 'hono/factory'
import { z } from 'zod'

const taskStatus = z.enum(['todo', 'in_progress', 'completed'])
const context = z.enum(['work', 'personal', 'dev'])

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  parentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  context: context.optional(),
  labels: z.array(z.string()).optional(),
  recurrenceRule: recurrenceRuleSchema.optional(),
})

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  context: context.optional(),
  recurrenceRule: recurrenceRuleSchema.nullable().optional(),
})

const updateStatusSchema = z.object({
  status: taskStatus,
})

const updateParentSchema = z.object({
  parentId: z.string().uuid().nullable(),
})

const listQuerySchema = z.object({
  status: taskStatus.optional(),
  projectId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  context: context.optional(),
})

const treeQuerySchema = z.object({
  rootId: z.string().uuid().optional(),
})

const searchQuerySchema = z.object({
  q: z.string().optional(),
  status: taskStatus.optional(),
  label: z.string().optional(),
  context: context.optional(),
  hasEstimate: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  hasDue: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  sortBy: z.enum(['due', 'created', 'estimate']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

const suggestQuerySchema = z.object({
  prefix: z.string(),
  category: z.string().optional(),
})

function recurrenceRuleToResponse(rule: typeof recurrenceRules.$inferSelect) {
  return {
    id: rule.id,
    type: rule.type,
    interval: rule.interval,
    daysOfWeek: rule.daysOfWeek,
    dayOfMonth: rule.dayOfMonth,
  }
}

function taskToResponse(
  task: typeof tasks.$inferSelect,
  rule?: typeof recurrenceRules.$inferSelect | null,
) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    context: task.context,
    startDate: task.startDate,
    dueDate: task.dueDate,
    estimatedMinutes: task.estimatedMinutes,
    parentId: task.parentId,
    projectId: task.projectId,
    recurrenceRuleId: task.recurrenceRuleId,
    recurrenceRule: rule ? recurrenceRuleToResponse(rule) : null,
    sortOrder: task.sortOrder,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}

function timeBlockToResponse(block: typeof timeBlocks.$inferSelect) {
  return {
    id: block.id,
    taskId: block.taskId,
    startTime: block.startTime.toISOString(),
    endTime: block.endTime?.toISOString() ?? null,
    isAutoScheduled: block.isAutoScheduled,
    createdAt: block.createdAt.toISOString(),
    updatedAt: block.updatedAt.toISOString(),
  }
}

type TaskResponseData = ReturnType<typeof taskToResponse>

type TreeNode = TaskResponseData & {
  children: TreeNode[]
  childCompletionCount: { completed: number; total: number }
}

function buildTree(
  allTasks: Array<typeof tasks.$inferSelect>,
  rootId?: string,
): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>()

  for (const task of allTasks) {
    nodeMap.set(task.id, {
      ...taskToResponse(task),
      children: [],
      childCompletionCount: { completed: 0, total: 0 },
    })
  }

  const roots: TreeNode[] = []

  for (const task of allTasks) {
    const node = nodeMap.get(task.id)!
    const parentNode = task.parentId ? nodeMap.get(task.parentId) : null

    if (parentNode) {
      parentNode.children.push(node)
      parentNode.childCompletionCount.total++
      if (task.status === 'completed') {
        parentNode.childCompletionCount.completed++
      }
    } else if (!rootId || task.id === rootId) {
      roots.push(node)
    }
  }

  if (rootId) {
    return nodeMap.has(rootId) ? [nodeMap.get(rootId)!] : []
  }

  return roots
}

type TaskEnv = {
  Variables: {
    task: typeof tasks.$inferSelect
  }
}

const factory = createFactory<TaskEnv>()

const requireTask = factory.createMiddleware(async (c, next) => {
  const id = c.req.param('id')!

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
  })
  if (!task) {
    return c.json({ error: 'Task not found' }, 404)
  }

  c.set('task', task)
  return next()
})

async function updateStatusAndCloseTimeBlocks(
  taskId: string,
  status: 'todo' | 'completed',
) {
  const now = new Date()
  const [[updatedTask], closedBlocks] = await Promise.all([
    db
      .update(tasks)
      .set({ status, updatedAt: now })
      .where(eq(tasks.id, taskId))
      .returning(),
    db
      .update(timeBlocks)
      .set({ endTime: now, updatedAt: now })
      .where(and(eq(timeBlocks.taskId, taskId), isNull(timeBlocks.endTime)))
      .returning(),
  ])
  return [updatedTask!, closedBlocks] as const
}
export const tasksApp = new Hono()
  // Task CRUD
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

    // Create recurrence rule if provided
    let recurrenceRuleId: string | null = null
    let createdRule: typeof recurrenceRules.$inferSelect | null = null
    if (input.recurrenceRule) {
      const [rule] = await db
        .insert(recurrenceRules)
        .values({
          type: input.recurrenceRule.type,
          interval: input.recurrenceRule.interval,
          daysOfWeek: input.recurrenceRule.daysOfWeek ?? null,
          dayOfMonth: input.recurrenceRule.dayOfMonth ?? null,
        })
        .returning()
      recurrenceRuleId = rule!.id
      createdRule = rule!
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
        recurrenceRuleId,
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

    return c.json(taskToResponse(task!, createdRule), 201)
  })
  .get('/', zValidator('query', listQuerySchema), async (c) => {
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
      .select()
      .from(tasks)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(tasks.sortOrder, tasks.createdAt)

    return c.json(
      result.map((t) => taskToResponse(t)),
      200,
    )
  })
  .get('/tree', zValidator('query', treeQuerySchema), async (c) => {
    const { rootId } = c.req.valid('query')

    let treeTasks: Array<typeof tasks.$inferSelect>

    if (rootId) {
      // Use recursive CTE to fetch only IDs in the subtree
      const subtreeIds = await db.execute<{ id: string }>(sql`
        WITH RECURSIVE subtree AS (
          SELECT id FROM ${tasks} WHERE id = ${rootId}
          UNION ALL
          SELECT t.id
          FROM ${tasks} t
          INNER JOIN subtree s ON t.parent_id = s.id
        )
        SELECT id FROM subtree
      `)

      const ids = (subtreeIds as Array<{ id: string }>).map((r) => r.id)
      if (ids.length === 0) {
        return c.json([], 200)
      }

      treeTasks = await db
        .select()
        .from(tasks)
        .where(inArray(tasks.id, ids))
        .orderBy(tasks.sortOrder, tasks.createdAt)
    } else {
      treeTasks = await db
        .select()
        .from(tasks)
        .orderBy(tasks.sortOrder, tasks.createdAt)
    }

    return c.json(buildTree(treeTasks, rootId), 200)
  })
  .get('/search', zValidator('query', searchQuerySchema), async (c) => {
    const query = c.req.valid('query')
    const conditions = []

    if (query.q) {
      conditions.push(
        sql`(${tasks.title} ILIKE ${'%' + query.q + '%'} OR ${tasks.description} ILIKE ${'%' + query.q + '%'})`,
      )
    }
    if (query.status) {
      conditions.push(eq(tasks.status, query.status))
    }
    if (query.context) {
      conditions.push(eq(tasks.context, query.context))
    }
    if (query.hasEstimate === true) {
      conditions.push(isNotNull(tasks.estimatedMinutes))
    } else if (query.hasEstimate === false) {
      conditions.push(sql`${tasks.estimatedMinutes} IS NULL`)
    }
    if (query.hasDue === true) {
      conditions.push(isNotNull(tasks.dueDate))
    } else if (query.hasDue === false) {
      conditions.push(sql`${tasks.dueDate} IS NULL`)
    }

    const orderBy = (() => {
      switch (query.sortBy) {
        case 'due':
          return tasks.dueDate
        case 'created':
          return tasks.createdAt
        case 'estimate':
          return tasks.estimatedMinutes
        default:
          return tasks.createdAt
      }
    })()

    const limit = query.limit ?? 20
    const offset = query.offset ?? 0

    const result = await db
      .select()
      .from(tasks)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset)

    return c.json(
      result.map((t) => taskToResponse(t)),
      200,
    )
  })
  .get('/search/suggest', zValidator('query', suggestQuerySchema), (c) => {
    const { prefix, category } = c.req.valid('query')

    const allSuggestions: Record<
      string,
      Array<{ value: string; display: string }>
    > = {
      is: [
        { value: 'is:todo', display: 'Todo' },
        { value: 'is:in_progress', display: 'In Progress' },
        { value: 'is:completed', display: 'Completed' },
      ],
      context: [
        { value: 'context:work', display: 'Work' },
        { value: 'context:personal', display: 'Personal' },
        { value: 'context:dev', display: 'Dev' },
      ],
      sort: [
        { value: 'sort:due', display: 'Sort by due date' },
        { value: 'sort:created', display: 'Sort by creation date' },
        { value: 'sort:estimate', display: 'Sort by estimate' },
      ],
    }

    const categories = category ? [category] : Object.keys(allSuggestions)
    const suggestions = categories.flatMap((cat) =>
      (allSuggestions[cat] ?? [])
        .filter((s) => s.value.startsWith(prefix))
        .map((s) => ({ ...s, category: cat })),
    )

    return c.json(suggestions, 200)
  })
  .get('/:id', requireTask, async (c) => {
    const task = c.get('task')
    const id = task.id

    // Get child completion count, pages, time blocks, and recurrence rule in parallel
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
      task.recurrenceRuleId
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
        // Remove recurrence rule association
        recurrenceRuleId = null
        if (existing.recurrenceRuleId) {
          // Only delete the rule if no other task references it
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
        if (existing.recurrenceRuleId) {
          // Update existing rule
          const [rule] = await db
            .update(recurrenceRules)
            .set({
              type: recurrenceRuleInput.type,
              interval: recurrenceRuleInput.interval,
              daysOfWeek: recurrenceRuleInput.daysOfWeek ?? null,
              dayOfMonth: recurrenceRuleInput.dayOfMonth ?? null,
              updatedAt: new Date(),
            })
            .where(eq(recurrenceRules.id, existing.recurrenceRuleId))
            .returning()
          updatedRule = rule!
        } else {
          // Create new rule
          const [rule] = await db
            .insert(recurrenceRules)
            .values({
              type: recurrenceRuleInput.type,
              interval: recurrenceRuleInput.interval,
              daysOfWeek: recurrenceRuleInput.daysOfWeek ?? null,
              dayOfMonth: recurrenceRuleInput.dayOfMonth ?? null,
            })
            .returning()
          recurrenceRuleId = rule!.id
          updatedRule = rule!
        }
      }

      const [updated] = await db
        .update(tasks)
        .set({
          ...taskFields,
          ...(recurrenceRuleId !== undefined ? { recurrenceRuleId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, id))
        .returning()

      // Fetch rule if we didn't just create/update one but the task has one
      if (!updatedRule && updated!.recurrenceRuleId) {
        updatedRule =
          (await db.query.recurrenceRules.findFirst({
            where: eq(recurrenceRules.id, updated!.recurrenceRuleId),
          })) ?? null
      }

      return c.json(taskToResponse(updated!, updatedRule), 200)
    },
  )
  .patch(
    '/:id/status',
    requireTask,
    zValidator('json', updateStatusSchema),
    async (c) => {
      const id = c.req.param('id')
      const existing = c.get('task')
      const { status } = c.req.valid('json')

      const now = new Date()

      // Close open TimeBlocks when transitioning away from in_progress
      if (existing.status === 'in_progress' && status !== 'in_progress') {
        await db
          .update(timeBlocks)
          .set({ endTime: now, updatedAt: now })
          .where(and(eq(timeBlocks.taskId, id), isNull(timeBlocks.endTime)))
      }

      const [updated] = await db
        .update(tasks)
        .set({ status, updatedAt: now })
        .where(eq(tasks.id, id))
        .returning()

      return c.json(taskToResponse(updated!), 200)
    },
  )
  .patch(
    '/:id/parent',
    requireTask,
    zValidator('json', updateParentSchema),
    async (c) => {
      const id = c.req.param('id')
      const { parentId } = c.req.valid('json')

      if (parentId) {
        const parent = await db.query.tasks.findFirst({
          where: eq(tasks.id, parentId),
        })
        if (!parent) {
          return c.json({ error: 'Parent task not found' }, 404)
        }

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

        if ((ancestors as unknown[]).length > 0) {
          return c.json({ error: 'Circular reference detected' }, 409)
        }
      }

      const [updated] = await db
        .update(tasks)
        .set({ parentId, updatedAt: new Date() })
        .where(eq(tasks.id, id))
        .returning()

      return c.json(taskToResponse(updated!), 200)
    },
  )
  .post('/:id/start', requireTask, async (c) => {
    const id = c.req.param('id')
    const existing = c.get('task')

    if (existing.status === 'in_progress') {
      return c.json({ error: 'Task is already in progress' }, 409)
    }

    const now = new Date()

    const [[updatedTask], [createdBlock]] = await Promise.all([
      db
        .update(tasks)
        .set({ status: 'in_progress', updatedAt: now })
        .where(eq(tasks.id, id))
        .returning(),
      db.insert(timeBlocks).values({ taskId: id, startTime: now }).returning(),
    ])

    return c.json(
      {
        ...taskToResponse(updatedTask!),
        timeBlock: timeBlockToResponse(createdBlock!),
      },
      200,
    )
  })
  .post('/:id/stop', requireTask, async (c) => {
    const id = c.req.param('id')
    const existing = c.get('task')

    if (existing.status !== 'in_progress') {
      return c.json({ error: 'Task is not in progress' }, 409)
    }

    const [updatedTask, closedBlocks] = await updateStatusAndCloseTimeBlocks(
      id,
      'todo',
    )

    return c.json(
      {
        ...taskToResponse(updatedTask),
        closedTimeBlocks: closedBlocks.map(timeBlockToResponse),
      },
      200,
    )
  })
  .post('/:id/complete', requireTask, async (c) => {
    const id = c.req.param('id')

    const [updatedTask, closedBlocks] = await updateStatusAndCloseTimeBlocks(
      id,
      'completed',
    )

    // Generate next recurring task if recurrence rule is set
    let nextTask: ReturnType<typeof taskToResponse> | null = null
    let completedTaskRule: typeof recurrenceRules.$inferSelect | null = null
    if (updatedTask.recurrenceRuleId) {
      completedTaskRule =
        (await db.query.recurrenceRules.findFirst({
          where: eq(recurrenceRules.id, updatedTask.recurrenceRuleId),
        })) ?? null

      if (completedTaskRule) {
        const nextData = buildNextTaskData(updatedTask, completedTaskRule)
        const [created] = await db.insert(tasks).values(nextData).returning()
        nextTask = taskToResponse(created!, completedTaskRule)
      }
    }

    return c.json(
      {
        ...taskToResponse(updatedTask, completedTaskRule),
        closedTimeBlocks: closedBlocks.map(timeBlockToResponse),
        nextTask,
      },
      200,
    )
  })
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
