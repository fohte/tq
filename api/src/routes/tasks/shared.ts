import { eq } from 'drizzle-orm'
import { createFactory } from 'hono/factory'
import { err, ok, type Result } from 'neverthrow'
import { z } from 'zod'

import { db } from '#db/connection'
import { recurrenceRules, taskGithubLinks, tasks, timeBlocks } from '#db/schema'
import { githubLinkToResponse } from '#routes/task-github-link'

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
  githubLink?: typeof taskGithubLinks.$inferSelect | null,
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
    githubLink: githubLink ? githubLinkToResponse(githubLink) : null,
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
  linksByTaskId?: Map<string, typeof taskGithubLinks.$inferSelect>,
): Result<TreeNode[], TaskTreeConsistencyError> {
  const nodeMap = new Map<string, TreeNode>()

  for (const task of allTasks) {
    nodeMap.set(task.id, {
      ...taskToResponse(task, undefined, linksByTaskId?.get(task.id)),
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
