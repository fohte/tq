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

function hasTaskDescription(
  row: TaskListRow | TaskListRowWithoutDescription,
): row is TaskListRow {
  return 'description' in row.task
}

function addTaskDescriptionColumn(
  row: TaskListRow | TaskListRowWithoutDescription,
): TaskListRow {
  if (hasTaskDescription(row)) return row

  return {
    ...row,
    task: { ...row.task, description: null },
  }
}

function makeTaskListQueryResult(
  view: ListTasksQuery['view'],
  rows: (TaskListRow | TaskListRowWithoutDescription)[],
  ancestorOnlyIds: Set<string>,
  matchByTaskId: Map<string, TaskSearchMatch> | undefined,
): TaskListQueryResult {
  if (view === 'full') {
    return {
      view,
      rows: rows.map(addTaskDescriptionColumn),
      ancestorOnlyIds,
      matchByTaskId,
    }
  }

  return {
    view,
    rows,
    ancestorOnlyIds,
    matchByTaskId,
  }
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

  const selectedRows =
    query.view === 'full'
      ? selectTaskListRows()
      : selectTaskListRowsWithoutDescription()
  let listQuery = selectedRows
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      ...(prioritizeTitleMatches
        ? [
            desc(buildTitleMatchCondition(words)),
            desc(tasks.updatedAt),
            desc(tasks.number),
          ]
        : resolveTaskListOrderBy(sortBy)),
    )
    .$dynamic()
  if (typeof query.limit === 'number') {
    listQuery = listQuery.limit(query.limit)
  }
  if (query.offset != null) listQuery = listQuery.offset(query.offset)

  const matched = await listQuery
  const matchByTaskId =
    options.includeSearchMatch === true && words.length > 0
      ? await queryTaskSearchMatches(matched, words)
      : undefined
  if (query.includeAncestors !== true || matched.length === 0) {
    return makeTaskListQueryResult(
      query.view,
      matched,
      new Set(),
      matchByTaskId,
    )
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
    return makeTaskListQueryResult(
      query.view,
      matched,
      new Set(),
      matchByTaskId,
    )
  }

  const ancestorRows =
    query.view === 'full'
      ? await selectTaskListRows().where(inArray(tasks.id, newAncestorIds))
      : await selectTaskListRowsWithoutDescription().where(
          inArray(tasks.id, newAncestorIds),
        )
  return makeTaskListQueryResult(
    query.view,
    [...matched, ...ancestorRows],
    new Set(newAncestorIds),
    matchByTaskId,
  )
}
