import { db } from '@api/db/connection'
import { recurrenceRules, tasks, timeBlocks } from '@api/db/schema'
import { firstOrThrow } from '@api/lib/drizzle-utils'
import { and, eq, isNull } from 'drizzle-orm'
import { createFactory } from 'hono/factory'
import { z } from 'zod'

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

export function buildTree(
  allTasks: Array<typeof tasks.$inferSelect>,
  activeStartTimes: Map<string, string>,
  rootId?: string,
): TreeNode[] {
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
    if (!node) throw new Error(`Node not found for task ${task.id}`)
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
    return rootNode != null ? [rootNode] : []
  }

  return roots
}

type TaskEnv = {
  Variables: {
    task: typeof tasks.$inferSelect
  }
}

const factory = createFactory<TaskEnv, '/:id'>()

export const requireTask = factory.createMiddleware(async (c, next) => {
  const id = c.req.param('id')

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
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
