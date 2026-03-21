import { db } from '@api/db/connection'
import { labels, taskLabels, tasks } from '@api/db/schema'
import { zValidator } from '@hono/zod-validator'
import { and, count, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
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
})

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  context: context.optional(),
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

function taskToResponse(task: typeof tasks.$inferSelect) {
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
    sortOrder: task.sortOrder,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
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

    return c.json(result.map(taskToResponse), 200)
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

    return c.json(result.map(taskToResponse), 200)
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
  .get('/:id', async (c) => {
    const id = c.req.param('id')

    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
    })

    if (!task) {
      return c.json({ error: 'Task not found' }, 404)
    }

    // Get child completion count
    const childStats = await db
      .select({
        total: count(),
        completed: count(
          sql`CASE WHEN ${tasks.status} = 'completed' THEN 1 END`,
        ),
      })
      .from(tasks)
      .where(eq(tasks.parentId, id))

    return c.json(
      {
        ...taskToResponse(task),
        childCompletionCount: {
          total: childStats[0]?.total ?? 0,
          completed: childStats[0]?.completed ?? 0,
        },
      },
      200,
    )
  })
  .patch('/:id', zValidator('json', updateTaskSchema), async (c) => {
    const id = c.req.param('id')
    const input = c.req.valid('json')

    const existing = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
    })
    if (!existing) {
      return c.json({ error: 'Task not found' }, 404)
    }

    const [updated] = await db
      .update(tasks)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning()

    return c.json(taskToResponse(updated!), 200)
  })
  .patch('/:id/status', zValidator('json', updateStatusSchema), async (c) => {
    const id = c.req.param('id')
    const { status } = c.req.valid('json')

    const existing = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
    })
    if (!existing) {
      return c.json({ error: 'Task not found' }, 404)
    }

    const [updated] = await db
      .update(tasks)
      .set({ status, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning()

    return c.json(taskToResponse(updated!), 200)
  })
  .patch('/:id/parent', zValidator('json', updateParentSchema), async (c) => {
    const id = c.req.param('id')
    const { parentId } = c.req.valid('json')

    const existing = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
    })
    if (!existing) {
      return c.json({ error: 'Task not found' }, 404)
    }

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
  })
  .delete('/:id', async (c) => {
    const id = c.req.param('id')

    const existing = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
    })
    if (!existing) {
      return c.json({ error: 'Task not found' }, 404)
    }

    // Set children's parentId to null before deleting
    await db
      .update(tasks)
      .set({ parentId: null, updatedAt: new Date() })
      .where(eq(tasks.parentId, id))

    await db.delete(tasks).where(eq(tasks.id, id))

    return c.body(null, 204)
  })
