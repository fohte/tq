import { db } from '@api/db/connection'
import { tasks } from '@api/db/schema'
import { zValidator } from '@hono/zod-validator'
import { and, count, eq, isNotNull, sql } from 'drizzle-orm'
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
})

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  context: context.nullable().optional(),
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

// db.execute returns raw rows with snake_case column names
interface RawTaskRow {
  id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'completed'
  context: 'work' | 'personal' | 'dev'
  start_date: string | null
  due_date: string | null
  estimated_minutes: number | null
  parent_id: string | null
  project_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
  depth: number
}

function rawRowToResponse(row: RawTaskRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    context: row.context,
    startDate: row.start_date,
    dueDate: row.due_date,
    estimatedMinutes: row.estimated_minutes,
    parentId: row.parent_id,
    projectId: row.project_id,
    sortOrder: row.sort_order,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
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

    const result = await db
      .select()
      .from(tasks)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(tasks.sortOrder, tasks.createdAt)

    return c.json(result.map(taskToResponse), 200)
  })
  .get('/tree', zValidator('query', treeQuerySchema), async (c) => {
    const { rootId } = c.req.valid('query')

    // Use recursive CTE to fetch task tree
    const rootCondition = rootId
      ? sql`${tasks.id} = ${rootId}`
      : sql`${tasks.parentId} IS NULL`

    const treeQuery = sql`
      WITH RECURSIVE task_tree AS (
        SELECT *, 0 AS depth
        FROM ${tasks}
        WHERE ${rootCondition}

        UNION ALL

        SELECT t.*, tt.depth + 1
        FROM ${tasks} t
        INNER JOIN task_tree tt ON t.parent_id = tt.id
      )
      SELECT * FROM task_tree ORDER BY depth, sort_order, created_at
    `

    const result = await db.execute(treeQuery)
    const rows = result as unknown as RawTaskRow[]

    // Build tree structure
    type TreeNode = ReturnType<typeof rawRowToResponse> & {
      children: TreeNode[]
      childCompletionCount: { completed: number; total: number }
    }

    const nodeMap = new Map<string, TreeNode>()
    const roots: TreeNode[] = []

    for (const row of rows) {
      const node: TreeNode = {
        ...rawRowToResponse(row),
        children: [],
        childCompletionCount: { completed: 0, total: 0 },
      }
      nodeMap.set(row.id, node)
    }

    for (const row of rows) {
      const node = nodeMap.get(row.id)!
      const parentNode = row.parent_id ? nodeMap.get(row.parent_id) : null

      if (parentNode) {
        parentNode.children.push(node)
        parentNode.childCompletionCount.total++
        if (row.status === 'completed') {
          parentNode.childCompletionCount.completed++
        }
      } else {
        roots.push(node)
      }
    }

    return c.json(roots, 200)
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
    if (query.hasEstimate) {
      conditions.push(isNotNull(tasks.estimatedMinutes))
    }
    if (query.hasDue) {
      conditions.push(isNotNull(tasks.dueDate))
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
    // Return static suggestions for now
    const { prefix, category } = c.req.valid('query')

    const suggestions: Array<{
      value: string
      display: string
      category: string
    }> = []

    if (!category || category === 'is') {
      if ('is:todo'.startsWith(prefix)) {
        suggestions.push({
          value: 'is:todo',
          display: 'Todo',
          category: 'is',
        })
      }
      if ('is:in_progress'.startsWith(prefix)) {
        suggestions.push({
          value: 'is:in_progress',
          display: 'In Progress',
          category: 'is',
        })
      }
      if ('is:completed'.startsWith(prefix)) {
        suggestions.push({
          value: 'is:completed',
          display: 'Completed',
          category: 'is',
        })
      }
    }

    if (!category || category === 'context') {
      if ('context:work'.startsWith(prefix)) {
        suggestions.push({
          value: 'context:work',
          display: 'Work',
          category: 'context',
        })
      }
      if ('context:personal'.startsWith(prefix)) {
        suggestions.push({
          value: 'context:personal',
          display: 'Personal',
          category: 'context',
        })
      }
      if ('context:dev'.startsWith(prefix)) {
        suggestions.push({
          value: 'context:dev',
          display: 'Dev',
          category: 'context',
        })
      }
    }

    if (!category || category === 'sort') {
      if ('sort:due'.startsWith(prefix)) {
        suggestions.push({
          value: 'sort:due',
          display: 'Sort by due date',
          category: 'sort',
        })
      }
      if ('sort:created'.startsWith(prefix)) {
        suggestions.push({
          value: 'sort:created',
          display: 'Sort by creation date',
          category: 'sort',
        })
      }
      if ('sort:estimate'.startsWith(prefix)) {
        suggestions.push({
          value: 'sort:estimate',
          display: 'Sort by estimate',
          category: 'sort',
        })
      }
    }

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

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (input.title !== undefined) updateData['title'] = input.title
    if (input.description !== undefined)
      updateData['description'] = input.description
    if (input.startDate !== undefined) updateData['startDate'] = input.startDate
    if (input.dueDate !== undefined) updateData['dueDate'] = input.dueDate
    if (input.estimatedMinutes !== undefined)
      updateData['estimatedMinutes'] = input.estimatedMinutes
    if (input.parentId !== undefined) updateData['parentId'] = input.parentId
    if (input.projectId !== undefined) updateData['projectId'] = input.projectId
    if (input.context !== undefined) updateData['context'] = input.context

    const [updated] = await db
      .update(tasks)
      .set(updateData)
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
      // Check parent exists
      const parent = await db.query.tasks.findFirst({
        where: eq(tasks.id, parentId),
      })
      if (!parent) {
        return c.json({ error: 'Parent task not found' }, 404)
      }

      // Check for circular reference using recursive CTE
      if (parentId === id) {
        return c.json({ error: 'A task cannot be its own parent' }, 409)
      }

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
