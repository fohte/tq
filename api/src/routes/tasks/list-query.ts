import { and, eq, exists, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#db/connection'
import {
  labels,
  taskComments,
  taskGithubLinks,
  taskLabels,
  taskPages,
  tasks,
} from '#db/schema'
import { parentTasks, resolveTaskListOrderBy } from '#routes/tasks/shared'
import type { ListTasksQuery } from '#schemas/task'
import { parseSearchQuery } from '#search-query-parser'

function selectTaskListRows() {
  return db
    .select({
      task: tasks,
      parentNumber: parentTasks.number,
      githubLink: taskGithubLinks,
    })
    .from(tasks)
    .leftJoin(parentTasks, eq(parentTasks.id, tasks.parentId))
    .leftJoin(taskGithubLinks, eq(tasks.id, taskGithubLinks.taskId))
}

export type TaskListRow = Awaited<ReturnType<typeof selectTaskListRows>>[number]

function buildConditions(query: ListTasksQuery) {
  const parsed = query.q != null ? parseSearchQuery(query.q) : null
  const conditions = []

  const statuses = parsed?.status != null ? [parsed.status] : query.status
  if (statuses != null && statuses.length > 0) {
    conditions.push(inArray(tasks.status, statuses))
  }

  const context = parsed?.context ?? query.context
  if (context != null) {
    conditions.push(eq(tasks.context, context))
  }

  const labelName = parsed?.label ?? query.label
  if (labelName != null) {
    conditions.push(
      exists(
        db
          .select({ _: sql`1` })
          .from(taskLabels)
          .innerJoin(labels, eq(taskLabels.labelId, labels.id))
          .where(
            and(eq(taskLabels.taskId, tasks.id), eq(labels.name, labelName)),
          ),
      ),
    )
  }

  if (parsed?.hasPages === true) {
    conditions.push(
      exists(
        db
          .select({ _: sql`1` })
          .from(taskPages)
          .where(eq(taskPages.taskId, tasks.id)),
      ),
    )
  }

  if (parsed?.hasComments === true) {
    conditions.push(
      exists(
        db
          .select({ _: sql`1` })
          .from(taskComments)
          .where(eq(taskComments.taskId, tasks.id)),
      ),
    )
  }

  const parentId = parsed?.parentId ?? query.parentId
  if (parentId != null) {
    conditions.push(eq(tasks.parentId, parentId))
  }

  const projectId = parsed?.projectId ?? query.projectId
  if (projectId != null) {
    conditions.push(eq(tasks.projectId, projectId))
  }

  if (query.hasEstimate === true) {
    conditions.push(isNotNull(tasks.estimatedMinutes))
  } else if (query.hasEstimate === false) {
    conditions.push(isNull(tasks.estimatedMinutes))
  }
  if (query.hasDue === true) {
    conditions.push(isNotNull(tasks.dueDate))
  } else if (query.hasDue === false) {
    conditions.push(isNull(tasks.dueDate))
  }

  if (parsed?.freeText != null && parsed.freeText !== '') {
    const freeText = parsed.freeText
    const pattern = `%${freeText}%`
    const numberQuery = freeText.startsWith('#') ? freeText.slice(1) : freeText
    const numberCondition =
      numberQuery !== '' && /^\d+$/.test(numberQuery)
        ? sql`OR CAST(${tasks.number} AS TEXT) LIKE ${`${numberQuery}%`}`
        : sql``
    conditions.push(
      sql`(${tasks.title} ILIKE ${pattern} OR ${tasks.description} ILIKE ${pattern} OR EXISTS (SELECT 1 FROM ${taskPages} WHERE ${taskPages.taskId} = ${tasks.id} AND ${taskPages.content} ILIKE ${pattern}) ${numberCondition})`,
    )
  }

  if (query.descendantOf != null) {
    conditions.push(
      sql`${tasks.id} IN (
        WITH RECURSIVE descendant_ids AS (
          SELECT id FROM ${tasks} WHERE parent_id = ${query.descendantOf}
          UNION ALL
          SELECT t.id FROM ${tasks} t INNER JOIN descendant_ids d ON t.parent_id = d.id
        )
        SELECT id FROM descendant_ids
      )`,
    )
  }

  return { conditions, sortBy: parsed?.sortBy ?? query.sortBy }
}

const ancestorIdSchema = z.array(z.object({ id: z.string() }))

export async function queryTaskList(query: ListTasksQuery): Promise<{
  rows: TaskListRow[]
  ancestorOnlyIds: Set<string>
}> {
  const { conditions, sortBy } = buildConditions(query)

  let listQuery = selectTaskListRows()
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(...resolveTaskListOrderBy(sortBy))
    .$dynamic()
  if (query.limit != null) listQuery = listQuery.limit(query.limit)
  if (query.offset != null) listQuery = listQuery.offset(query.offset)

  const matched = await listQuery
  if (query.includeAncestors !== true || matched.length === 0) {
    return { rows: matched, ancestorOnlyIds: new Set() }
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
    return { rows: matched, ancestorOnlyIds: new Set() }
  }

  const ancestorRows = await selectTaskListRows().where(
    inArray(tasks.id, newAncestorIds),
  )
  return {
    rows: [...matched, ...ancestorRows],
    ancestorOnlyIds: new Set(newAncestorIds),
  }
}
