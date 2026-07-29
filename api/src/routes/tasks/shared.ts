import { eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { createFactory } from 'hono/factory'
import { err, ok, type Result } from 'neverthrow'
import { z } from 'zod'

import { db } from '#db/connection'
import { recurrenceRules, tasks, timeBlocks } from '#db/schema'

export const taskStatus = z.enum(['todo', 'in_progress', 'completed'])
export const contextEnum = z.enum(['work', 'personal', 'dev'])

export function recurrenceRuleToResponse(
  rule: typeof recurrenceRules.$inferSelect,
) {
  return {
    id: rule.id,
    type: rule.type,
    interval: rule.interval,
    daysOfWeek: rule.daysOfWeek,
    dayOfMonth: rule.dayOfMonth,
  }
}

export function taskToResponse(
  task: typeof tasks.$inferSelect,
  rule?: typeof recurrenceRules.$inferSelect | null,
) {
  return {
    id: task.id,
    number: task.number,
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

// Self-join alias resolving a task row's parent's `number`, for list
// endpoints that render a "← #<parent number>" reference without fetching
// the whole parent task. Callers add `.leftJoin(parentTasks, eq(parentTasks.id, tasks.parentId))`
// and select `parentTasks.number`, then format the row with
// `taskWithParentNumberToResponse`.
export const parentTasks = alias(tasks, 'parent_task')

export function taskWithParentNumberToResponse(
  task: typeof tasks.$inferSelect,
  parentNumber: number | null,
) {
  return { ...taskToResponse(task), parentNumber }
}

export function timeBlockToResponse(block: typeof timeBlocks.$inferSelect) {
  return {
    id: block.id,
    taskId: block.taskId,
    startTime: block.startTime.toISOString(),
    endTime: block.endTime.toISOString(),
    isAutoScheduled: block.isAutoScheduled,
    createdAt: block.createdAt.toISOString(),
    updatedAt: block.updatedAt.toISOString(),
  }
}

export type TaskResponseData = ReturnType<typeof taskToResponse>

export type TreeNode = TaskResponseData & {
  children: TreeNode[]
  childCompletionCount: { completed: number; total: number }
}

export class TaskTreeConsistencyError extends Error {
  constructor(taskId: string) {
    super(`Node not found for task ${taskId}`)
    this.name = 'TaskTreeConsistencyError'
  }
}

export function buildTree(
  allTasks: Array<typeof tasks.$inferSelect>,
  rootId?: string,
): Result<TreeNode[], TaskTreeConsistencyError> {
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
    const node = nodeMap.get(task.id)
    if (!node) {
      // Every task.id was set as a key in the loop above, so this can only
      // happen if allTasks mutated between the two loops.
      return err(new TaskTreeConsistencyError(task.id))
    }
    const parentNode = task.parentId != null ? nodeMap.get(task.parentId) : null

    if (parentNode) {
      parentNode.children.push(node)
      parentNode.childCompletionCount.total++
      if (task.status === 'completed') {
        parentNode.childCompletionCount.completed++
      }
    } else if (rootId == null || task.id === rootId) {
      roots.push(node)
    }
  }

  if (rootId != null) {
    const rootNode = nodeMap.get(rootId)
    return ok(rootNode != null ? [rootNode] : [])
  }

  return ok(roots)
}

type TaskEnv = {
  Variables: {
    task: typeof tasks.$inferSelect
  }
}

const factory = createFactory<TaskEnv, '/:id'>()

const numericIdPattern = /^\d+$/
// `tasks.number` is a Postgres `integer`; a digit string past this range
// would make the query itself throw (500) instead of yielding a normal
// 404, so it's treated as a non-numeric (UUID-lookup, always-empty) id.
const PG_INTEGER_MAX = 2147483647

export const requireTask = factory.createMiddleware(async (c, next) => {
  const param = c.req.param('id')
  const isNumericId =
    numericIdPattern.test(param) && Number(param) <= PG_INTEGER_MAX

  // Task detail URLs accept either the UUID primary key or the human-facing
  // sequential number (e.g. `/tasks/123`), so bookmarked UUID links keep
  // working alongside the new short form.
  const task = await db.query.tasks.findFirst({
    where: isNumericId ? eq(tasks.number, Number(param)) : eq(tasks.id, param),
  })
  if (!task) {
    return c.json({ error: 'Task not found' }, 404)
  }

  c.set('task', task)
  return next()
})
