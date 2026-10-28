import { desc, eq, inArray, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { createFactory } from 'hono/factory'

import { db } from '#db/connection'
import { tasks } from '#db/schema'
import { setChangeEventTaskIds } from '#lib/change-events'
import { classifyNumericOrId } from '#lib/numeric-id'
import {
  getTaskChangeEventIds,
  getTaskChecklistOwnerIds,
} from '#routes/tasks/change-event-task-ids'
import { earliestUnresolvedTaskWaitFollowUpSubquery } from '#routes/tasks/list-query-waits'
import type { TaskSortBy, TaskSortOrder } from '#schemas/task'
import { hasUnacknowledgedResolvedTaskWaitCondition } from '#services/task-blockers'

export {
  getGithubLinksByTaskId,
  getLabelNamesByTaskId,
  getRecurrenceRulesByTemplateIds,
  hydrateTaskListRows,
  hydrateTaskListRowsWithoutDescription,
} from '#routes/tasks/task-list-hydration'
export {
  githubLinkToResponse,
  recurrenceRuleToResponse,
  taskToResponse,
  timeBlockToResponse,
} from '#routes/tasks/task-response'

function resolvePrimaryTaskListOrderBy(
  sortBy: TaskSortBy | undefined,
  order: TaskSortOrder,
) {
  switch (sortBy) {
    case 'updated':
      return order === 'desc' ? desc(tasks.updatedAt) : tasks.updatedAt
    case 'due':
      return order === 'desc'
        ? sql`${tasks.dueDate} DESC NULLS LAST`
        : sql`${tasks.dueDate} ASC NULLS LAST`
    case 'follow-up': {
      const waitResolved = hasUnacknowledgedResolvedTaskWaitCondition()
      const direction = order === 'desc' ? sql`DESC` : sql`ASC`
      return sql`CASE WHEN ${waitResolved} THEN 0 ELSE 1 END, (${earliestUnresolvedTaskWaitFollowUpSubquery()}) ${direction} NULLS LAST`
    }
    case 'created':
    default:
      return order === 'desc' ? desc(tasks.createdAt) : tasks.createdAt
  }
}

// `tasks.number` is a unique, monotonically increasing identity column, so
// appending it as a tiebreaker makes every ordering fully deterministic even
// when the primary sort key ties (e.g. rows created in the same
// transaction share one `now()`-derived `createdAt`), which limit/offset
// paging requires to avoid duplicate or skipped rows across pages.
export function resolveTaskListOrderBy(
  sortBy?: TaskSortBy,
  order?: TaskSortOrder,
) {
  const defaultOrder = sortBy === 'updated' ? 'desc' : 'asc'
  return [
    resolvePrimaryTaskListOrderBy(sortBy, order ?? defaultOrder),
    tasks.number,
  ]
}

// Self-join alias resolving a task row's parent's `number`, for list
// endpoints that render a "← #<parent number>" reference without fetching
// the whole parent task. Callers add `.leftJoin(parentTasks, eq(parentTasks.id, tasks.parentId))`
// and select `parentTasks.number`, then format the row with
// `hydrateTaskListRows`.
export const parentTasks = alias(tasks, 'parent_task')

export type TaskSearchMatch =
  | { field: 'title'; snippet: string }
  | { field: 'description'; snippet: string }
  | { field: 'page'; pageTitle: string; snippet: string }

export type TaskEnv = {
  Variables: {
    task: typeof tasks.$inferSelect
  }
}

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

// Resolves a create/set-parent request's raw `parentId` (id or number) to
// the parent's UUID, shared by the create and set-parent routes so the
// lookup and 404 body/status can't drift between them.
export async function resolveParentId(
  raw: string | number,
): Promise<
  { id: string } | { error: { body: { error: string }; status: 404 } }
> {
  const parent = await findTaskByIdOrNumber(String(raw))
  if (!parent) {
    return { error: { body: { error: 'Parent task not found' }, status: 404 } }
  }
  return { id: parent.id }
}

// Batch counterpart of `findTaskByIdOrNumber`; unmatched inputs are simply
// absent from the returned map.
async function findTasksByIdsOrNumbers(
  params: string[],
): Promise<Map<string, typeof tasks.$inferSelect>> {
  if (params.length === 0) return new Map()

  const classifiedByParam = new Map(
    params.map((param) => [param, classifyNumericOrId(param)] as const),
  )
  const numberValues: number[] = []
  const idValues: string[] = []
  for (const classified of classifiedByParam.values()) {
    if (classified.kind === 'number') numberValues.push(classified.value)
    else idValues.push(classified.value)
  }

  const conditions = [
    numberValues.length > 0 ? inArray(tasks.number, numberValues) : undefined,
    idValues.length > 0 ? inArray(tasks.id, idValues) : undefined,
  ].filter((c) => c != null)
  if (conditions.length === 0) return new Map()

  const rows = await db
    .select()
    .from(tasks)
    .where(or(...conditions))
  const byNumber = new Map(rows.map((row) => [row.number, row]))
  const byId = new Map(rows.map((row) => [row.id, row]))

  const result = new Map<string, typeof tasks.$inferSelect>()
  for (const [param, classified] of classifiedByParam) {
    const row =
      classified.kind === 'number'
        ? byNumber.get(classified.value)
        : byId.get(classified.value)
    if (row) result.set(param, row)
  }
  return result
}

export async function resolveTasksByIdsOrNumbers(params: string[]) {
  const byParam = await findTasksByIdsOrNumbers(params)
  const ids = [...new Set([...byParam.values()].map((task) => task.id))]
  return { byParam, ids }
}

const factory = createFactory<TaskEnv, '/:id'>()

export const requireTask = factory.createMiddleware(async (c, next) => {
  const task = await findTaskByIdOrNumber(c.req.param('id'))
  if (!task) {
    return c.json({ error: 'Task not found' }, 404)
  }

  c.set('task', task)
  await next()

  const isStatusWrite =
    (c.req.method === 'PATCH' && c.req.path.endsWith('/status')) ||
    (c.req.method === 'POST' && c.req.path.endsWith('/complete'))
  const isParentWrite =
    c.req.method === 'PATCH' && c.req.path.endsWith('/parent')
  if (
    (!isStatusWrite && !isParentWrite) ||
    c.res.status < 200 ||
    c.res.status >= 300
  ) {
    return
  }

  const currentTask = await db.query.tasks.findFirst({
    where: eq(tasks.id, task.id),
    columns: { parentId: true, status: true },
  })
  const taskIds = [task.id]
  if (isStatusWrite && currentTask?.status !== task.status) {
    if (task.parentId != null) taskIds.push(task.parentId)
    taskIds.push(...(await getTaskChecklistOwnerIds(task.id)))
  }
  if (isParentWrite && currentTask?.parentId !== task.parentId) {
    if (task.parentId != null) taskIds.push(task.parentId)
    if (currentTask?.parentId != null) taskIds.push(currentTask.parentId)
  }

  setChangeEventTaskIds(c, await getTaskChangeEventIds(taskIds))
  return undefined
})
