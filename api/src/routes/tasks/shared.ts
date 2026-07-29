import { and, eq, isNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { createFactory } from 'hono/factory'
import { err, ok, type Result } from 'neverthrow'
import { z } from 'zod'

import { db } from '#db/connection'
import { recurrenceRules, tasks, timeBlocks } from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'

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
// and select `parentTasks.number`.
export const parentTasks = alias(tasks, 'parent_task')

export function timeBlockToResponse(block: typeof timeBlocks.$inferSelect) {
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

export type TaskResponseData = ReturnType<typeof taskToResponse>

export type TreeNode = TaskResponseData & {
  activeTimeBlockStartTime: string | null
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
  activeStartTimes: Map<string, string>,
  rootId?: string,
): Result<TreeNode[], TaskTreeConsistencyError> {
  const nodeMap = new Map<string, TreeNode>()

  for (const task of allTasks) {
    nodeMap.set(task.id, {
      ...taskToResponse(task),
      activeTimeBlockStartTime: activeStartTimes.get(task.id) ?? null,
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

export const requireTask = factory.createMiddleware(async (c, next) => {
  const param = c.req.param('id')

  // Task detail URLs accept either the UUID primary key or the human-facing
  // sequential number (e.g. `/tasks/123`), so bookmarked UUID links keep
  // working alongside the new short form.
  const task = await db.query.tasks.findFirst({
    where: numericIdPattern.test(param)
      ? eq(tasks.number, Number(param))
      : eq(tasks.id, param),
  })
  if (!task) {
    return c.json({ error: 'Task not found' }, 404)
  }

  c.set('task', task)
  return next()
})

export async function updateStatusAndCloseTimeBlocks(
  taskId: string,
  status: 'todo' | 'completed',
) {
  const now = new Date()
  const [taskRows, closedBlocks] = await Promise.all([
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
  return [firstOrThrow(taskRows), closedBlocks] as const
}
