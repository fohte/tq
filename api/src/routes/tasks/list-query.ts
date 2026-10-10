import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#db/connection'
import { tasks } from '#db/schema'
import { buildTaskFilterConditions } from '#routes/tasks/list-query-conditions'
import {
  selectTaskListRows,
  selectTaskListRowsWithoutDescription,
} from '#routes/tasks/list-query-rows'
import {
  buildTitleMatchCondition,
  queryTaskSearchMatches,
} from '#routes/tasks/search-match-query'
import {
  parentTasks,
  resolveTaskListOrderBy,
  type TaskSearchMatch,
} from '#routes/tasks/shared'
import type { CountTasksQuery, ListTasksQuery } from '#schemas/task'

export { selectTaskListRows } from '#routes/tasks/list-query-rows'

export type TaskListRow = Awaited<ReturnType<typeof selectTaskListRows>>[number]
type TaskListRowWithoutDescription = Awaited<
  ReturnType<typeof selectTaskListRowsWithoutDescription>
>[number]

export async function queryTaskCount(query: CountTasksQuery): Promise<number> {
  const { conditions } = await buildTaskFilterConditions(query)
  const [result] = await db
    .select({ count: count() })
    .from(tasks)
    .leftJoin(parentTasks, eq(parentTasks.id, tasks.parentId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  return result?.count ?? 0
}

const ancestorIdSchema = z.array(z.object({ id: z.string() }))

type TaskListQueryResult =
  | {
      view: 'full'
      rows: TaskListRow[]
      ancestorOnlyIds: Set<string>
      matchByTaskId: Map<string, TaskSearchMatch> | undefined
    }
  | {
      view: 'row'
      rows: TaskListRowWithoutDescription[]
      ancestorOnlyIds: Set<string>
      matchByTaskId: Map<string, TaskSearchMatch> | undefined
    }

type TaskListQueryRows =
  | { view: 'full'; rows: TaskListRow[] }
  | { view: 'row'; rows: TaskListRowWithoutDescription[] }

function makeTaskListQueryResult(
  rows: TaskListQueryRows,
  ancestorOnlyIds: Set<string>,
  matchByTaskId: Map<string, TaskSearchMatch> | undefined,
): TaskListQueryResult {
  return {
    ...rows,
    ancestorOnlyIds,
    matchByTaskId,
  }
}

function paginateTaskListQuery<
  Query extends {
    limit: (limit: number) => Query
    offset: (offset: number) => Query
  },
>(
  listQuery: Query,
  limit: number | 'unlimited',
  offset: number | undefined,
): Query {
  let paginatedQuery = listQuery
  if (typeof limit === 'number') {
    paginatedQuery = paginatedQuery.limit(limit)
  }
  if (offset != null) paginatedQuery = paginatedQuery.offset(offset)
  return paginatedQuery
}

export async function queryTaskList(
  query: ListTasksQuery,
  options: {
    includeSearchMatch?: boolean
    prioritizeTitleMatches?: boolean
  } = {},
): Promise<TaskListQueryResult> {
  const {
    conditions,
    sortBy,
    freeTextWords: words,
  } = await buildTaskFilterConditions(query)
  const prioritizeTitleMatches =
    options.prioritizeTitleMatches === true &&
    sortBy == null &&
    words.length > 0

  const where = conditions.length > 0 ? and(...conditions) : undefined
  const orderBy = prioritizeTitleMatches
    ? [
        desc(buildTitleMatchCondition(words)),
        desc(tasks.updatedAt),
        desc(tasks.number),
      ]
    : resolveTaskListOrderBy(sortBy)
  const fullRowsQuery = selectTaskListRows()
    .where(where)
    .orderBy(...orderBy)
    .$dynamic()
  const rowRowsQuery = selectTaskListRowsWithoutDescription()
    .where(where)
    .orderBy(...orderBy)
    .$dynamic()
  const selectedRows =
    query.view === 'full'
      ? {
          view: 'full' as const,
          rows: await paginateTaskListQuery(
            fullRowsQuery,
            query.limit,
            query.offset,
          ),
        }
      : {
          view: 'row' as const,
          rows: await paginateTaskListQuery(
            rowRowsQuery,
            query.limit,
            query.offset,
          ),
        }
  const { rows: matched } = selectedRows
  const matchByTaskId =
    options.includeSearchMatch === true && words.length > 0
      ? await queryTaskSearchMatches(matched, words)
      : undefined
  if (query.includeAncestors !== true || matched.length === 0) {
    return makeTaskListQueryResult(selectedRows, new Set(), matchByTaskId)
  }

  const matchedIds = matched.map((r) => r.task.id)
  const ancestorIdRows = await db.execute<{ id: string }>(sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id FROM ${tasks} WHERE id IN (${sql.join(matchedIds, sql`, `)})
      UNION ALL
      SELECT t.id, t.parent_id
      FROM ${tasks} t
      INNER JOIN ancestors a ON t.id = a.parent_id
    )
    SELECT id FROM ancestors
  `)

  const matchedIdSet = new Set(matchedIds)
  const newAncestorIds = ancestorIdSchema
    .parse(ancestorIdRows)
    .map((r) => r.id)
    .filter((id) => !matchedIdSet.has(id))

  if (newAncestorIds.length === 0) {
    return makeTaskListQueryResult(selectedRows, new Set(), matchByTaskId)
  }

  if (selectedRows.view === 'full') {
    const ancestorRows = await selectTaskListRows().where(
      inArray(tasks.id, newAncestorIds),
    )
    return makeTaskListQueryResult(
      { view: 'full', rows: [...selectedRows.rows, ...ancestorRows] },
      new Set(newAncestorIds),
      matchByTaskId,
    )
  }

  const ancestorRows = await selectTaskListRowsWithoutDescription().where(
    inArray(tasks.id, newAncestorIds),
  )
  return makeTaskListQueryResult(
    { view: 'row', rows: [...selectedRows.rows, ...ancestorRows] },
    new Set(newAncestorIds),
    matchByTaskId,
  )
}
