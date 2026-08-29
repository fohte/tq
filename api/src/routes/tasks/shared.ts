import { count, desc, eq, inArray, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { createFactory } from 'hono/factory'
import { z } from 'zod'

import { db } from '#db/connection'
import {
  labels,
  recurrenceRules,
  taskGithubLinks,
  taskLabels,
  tasks,
  timeBlocks,
} from '#db/schema'
import { classifyNumericOrId, numericIdPattern } from '#lib/numeric-id'
import type { TaskSortBy } from '#schemas/task'

function resolvePrimaryTaskListOrderBy(sortBy?: TaskSortBy) {
  switch (sortBy) {
    case 'updated':
      return desc(tasks.updatedAt)
    case 'due':
      return tasks.dueDate
    case 'estimate':
      return tasks.estimatedMinutes
    case 'created':
    default:
      return tasks.createdAt
  }
}

// `tasks.number` is a unique, monotonically increasing identity column, so
// appending it as a tiebreaker makes every ordering fully deterministic even
// when the primary sort key ties (e.g. rows created in the same
// transaction share one `now()`-derived `createdAt`), which limit/offset
// paging requires to avoid duplicate or skipped rows across pages.
export function resolveTaskListOrderBy(sortBy?: TaskSortBy) {
  return [resolvePrimaryTaskListOrderBy(sortBy), tasks.number]
}

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

export function githubLinkToResponse(
  link: typeof taskGithubLinks.$inferSelect,
) {
  return {
    id: link.id,
    owner: link.owner,
    repo: link.repo,
    number: link.number,
    kind: link.kind,
    url: link.url,
    state: link.state,
    title: link.title,
    lastSyncedAt: link.lastSyncedAt.toISOString(),
  }
}

function taskCoreToResponse(
  task: typeof tasks.$inferSelect,
  githubLink?: typeof taskGithubLinks.$inferSelect | null,
  labelNames: string[] = [],
) {
  return {
    id: task.id,
    number: task.number,
    title: task.title,
    description: task.description,
    status: task.status,
    context: task.context,
    labels: labelNames,
    startDate: task.startDate,
    dueDate: task.dueDate,
    estimatedMinutes: task.estimatedMinutes,
    parentId: task.parentId,
    projectId: task.projectId,
    recurrenceRuleId: task.recurrenceRuleId,
    githubLink: githubLink ? githubLinkToResponse(githubLink) : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}

export function taskToResponse(
  task: typeof tasks.$inferSelect,
  rule?: typeof recurrenceRules.$inferSelect | null,
  githubLink?: typeof taskGithubLinks.$inferSelect | null,
  labelNames: string[] = [],
) {
  return {
    ...taskCoreToResponse(task, githubLink, labelNames),
    recurrenceRule: rule ? recurrenceRuleToResponse(rule) : null,
  }
}

// Batch-fetches label names for a set of task ids, keyed by task id, for
// list/tree endpoints that would otherwise issue one query per task.
export async function getLabelNamesByTaskId(
  taskIds: string[],
): Promise<Map<string, string[]>> {
  if (taskIds.length === 0) return new Map()

  const rows = await db
    .select({ taskId: taskLabels.taskId, name: labels.name })
    .from(taskLabels)
    .innerJoin(labels, eq(taskLabels.labelId, labels.id))
    .where(inArray(taskLabels.taskId, taskIds))

  const map = new Map<string, string[]>()
  for (const row of rows) {
    const list = map.get(row.taskId) ?? []
    list.push(row.name)
    map.set(row.taskId, list)
  }
  return map
}

// Batch-fetches each task's full child completion count keyed by parent id,
// for list endpoints that would otherwise issue one query per task. Always
// counts every child of a task regardless of the caller's own predicate
// filters, since it's a fresh unfiltered query keyed only by parentId.
export async function getChildCompletionCountsByTaskId(
  taskIds: string[],
): Promise<Map<string, { completed: number; total: number }>> {
  if (taskIds.length === 0) return new Map()

  const rows = await db
    .select({
      parentId: tasks.parentId,
      total: count(),
      completed: count(sql`CASE WHEN ${tasks.status} = 'completed' THEN 1 END`),
    })
    .from(tasks)
    .where(inArray(tasks.parentId, taskIds))
    .groupBy(tasks.parentId)

  const map = new Map<string, { completed: number; total: number }>()
  for (const row of rows) {
    if (row.parentId != null) {
      map.set(row.parentId, { completed: row.completed, total: row.total })
    }
  }
  return map
}

// Self-join alias resolving a task row's parent's `number`, for list
// endpoints that render a "← #<parent number>" reference without fetching
// the whole parent task. Callers add `.leftJoin(parentTasks, eq(parentTasks.id, tasks.parentId))`
// and select `parentTasks.number`, then format the row with
// `taskListItemToResponse`.
export const parentTasks = alias(tasks, 'parent_task')

// Shared response shape for the list-returning endpoint (`/api/tasks`). Omits
// `recurrenceRule`: no list consumer reads it, and hydrating it would cost an
// extra query per endpoint for a field nothing uses.
export function taskListItemToResponse(
  task: typeof tasks.$inferSelect,
  parentNumber: number | null,
  githubLink?: typeof taskGithubLinks.$inferSelect | null,
  labelNames: string[] = [],
) {
  return {
    ...taskCoreToResponse(task, githubLink, labelNames),
    parentNumber,
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

export type TaskListItemResponse = ReturnType<typeof taskListItemToResponse>

// Batch-hydrates a set of list-query rows (as returned by `selectTaskListRows`)
// with labels and child-completion counts in 2 queries total regardless of
// row count, for any endpoint that renders task rows via `TaskListItemResponse`
// (the `/api/tasks` list endpoint, and the task-detail page's linked tasks).
export async function hydrateTaskListRows(
  rows: {
    task: typeof tasks.$inferSelect
    parentNumber: number | null
    githubLink?: typeof taskGithubLinks.$inferSelect | null
  }[],
): Promise<
  (TaskListItemResponse & {
    childCompletionCount: { completed: number; total: number }
  })[]
> {
  const ids = rows.map((r) => r.task.id)
  const [labelsByTaskId, childCompletionCountsByTaskId] = await Promise.all([
    getLabelNamesByTaskId(ids),
    getChildCompletionCountsByTaskId(ids),
  ])

  return rows.map((r) => ({
    ...taskListItemToResponse(
      r.task,
      r.parentNumber,
      r.githubLink,
      labelsByTaskId.get(r.task.id) ?? [],
    ),
    childCompletionCount: childCompletionCountsByTaskId.get(r.task.id) ?? {
      completed: 0,
      total: 0,
    },
  }))
}

export type TaskListItemWithChildren<
  T extends { id: string; parentId: string | null },
> = T & { children: TaskListItemWithChildren<T>[] }

// Nests a flat list-item response array into a tree by parentId. A row
// whose parent isn't present in the input (e.g. filtered out, or excluded by
// a `descendantOf` query) surfaces as a root instead of being dropped.
export function nestTaskListRows<
  T extends { id: string; parentId: string | null },
>(rows: T[]): Array<TaskListItemWithChildren<T>> {
  const nodeMap = new Map<string, TaskListItemWithChildren<T>>()
  for (const row of rows) {
    nodeMap.set(row.id, { ...row, children: [] })
  }

  const roots: Array<TaskListItemWithChildren<T>> = []
  for (const row of rows) {
    const node = nodeMap.get(row.id)
    if (node == null) continue

    const parent = row.parentId != null ? nodeMap.get(row.parentId) : undefined
    if (parent != null) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

export type TaskEnv = {
  Variables: {
    task: typeof tasks.$inferSelect
  }
}

export const taskIdOrNumber = z.union([
  z.uuid(),
  z.string().regex(numericIdPattern),
  z.number().int().positive(),
])

// Task detail URLs (and their subresources) accept either the UUID primary
// key or the human-facing sequential number (e.g. `/tasks/123`), so
// bookmarked UUID links keep working alongside the short numeric form.
export function findTaskByIdOrNumber(param: string) {
  const classified = classifyNumericOrId(param)

  return db.query.tasks.findFirst({
    where:
      classified.kind === 'number'
        ? eq(tasks.number, classified.value)
        : eq(tasks.id, classified.value),
  })
}

const factory = createFactory<TaskEnv, '/:id'>()

export const requireTask = factory.createMiddleware(async (c, next) => {
  const task = await findTaskByIdOrNumber(c.req.param('id'))
  if (!task) {
    return c.json({ error: 'Task not found' }, 404)
  }

  c.set('task', task)
  return next()
})
