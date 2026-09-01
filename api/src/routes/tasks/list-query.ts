import {
  and,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  ne,
  notExists,
  sql,
} from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { z } from 'zod'

import { db } from '#db/connection'
import {
  labels,
  projects,
  taskComments,
  taskLabels,
  taskPages,
  taskRelations,
  tasks,
} from '#db/schema'
import { parentTasks, resolveTaskListOrderBy } from '#routes/tasks/shared'
import type { ListTasksQuery } from '#schemas/task'
import { parseSearchQuery } from '#search-query-parser'

// Each word adds an EXISTS subquery for task_pages, so cap the word count
// to keep an adversarial `q` from generating an unbounded number of them.
const MAX_FREE_TEXT_WORDS = 20

const childTasks = alias(tasks, 'child_task')
const blockerTasks = alias(tasks, 'blocker_task')

// Extracted so `exists`/`notExists` can both wrap the same predicate for
// hasBlockers/hasNoBlockers without duplicating the join and where clause.
function unresolvedBlockerSubquery() {
  return db
    .select({ _: sql`1` })
    .from(taskRelations)
    .innerJoin(blockerTasks, eq(blockerTasks.id, taskRelations.targetTaskId))
    .where(
      and(
        eq(taskRelations.sourceTaskId, tasks.id),
        eq(taskRelations.type, 'blocked_by'),
        ne(blockerTasks.status, 'completed'),
      ),
    )
}

export function selectTaskListRows() {
  return db
    .select({
      task: tasks,
      parentNumber: parentTasks.number,
    })
    .from(tasks)
    .leftJoin(parentTasks, eq(parentTasks.id, tasks.parentId))
}

export type TaskListRow = Awaited<ReturnType<typeof selectTaskListRows>>[number]

function buildConditions(query: ListTasksQuery) {
  const parsed = query.q != null ? parseSearchQuery(query.q) : null
  const conditions = []

  const statuses = parsed?.status ?? query.status
  if (statuses != null && statuses.length > 0) {
    conditions.push(inArray(tasks.status, statuses))
  }

  const context = parsed?.context ?? query.context
  if (context != null) {
    conditions.push(eq(tasks.context, context))
  }

  const commitment = parsed?.commitment ?? query.commitment
  if (commitment != null) {
    conditions.push(eq(tasks.commitment, commitment))
  }

  const reason = parsed?.reason ?? query.statusReason?.[0]
  if (reason != null) {
    conditions.push(eq(tasks.statusReason, reason))
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

  if (parsed?.hasNoChildren === true) {
    conditions.push(
      notExists(
        db
          .select({ _: sql`1` })
          .from(childTasks)
          .where(
            and(
              eq(childTasks.parentId, tasks.id),
              ne(childTasks.status, 'completed'),
            ),
          ),
      ),
    )
  }

  if (parsed?.hasBlockers === true) {
    conditions.push(exists(unresolvedBlockerSubquery()))
  }

  if (parsed?.hasNoBlockers === true) {
    conditions.push(notExists(unresolvedBlockerSubquery()))
  }

  const parentId = parsed?.parentId ?? query.parentId
  if (parentId === 'root') {
    conditions.push(isNull(tasks.parentId))
  } else if (parentId != null) {
    conditions.push(eq(tasks.parentId, parentId))
  }

  // Unlike the other filters above, an explicit `projectId` param wins over
  // one embedded in `q` — a route that pins its own scope (e.g.
  // /projects/$projectId) can't have that scope silently overridden by a
  // stray `project:` token typed into `q`.
  const projectIdentifier = query.projectId ?? parsed?.projectId
  if (projectIdentifier != null) {
    // UUID-shaped values are treated as an id match, not a title match, even
    // though `projects.title` has no format constraint and could coincide.
    if (z.uuid().safeParse(projectIdentifier).success) {
      conditions.push(eq(tasks.projectId, projectIdentifier))
    } else {
      conditions.push(
        exists(
          db
            .select({ _: sql`1` })
            .from(projects)
            .where(
              and(
                eq(projects.id, tasks.projectId),
                eq(projects.title, projectIdentifier),
              ),
            ),
        ),
      )
    }
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
    // `freeText` is `parseSearchQuery`'s tokens re-joined with spaces (see
    // search-query-parser.ts), so splitting on whitespace here treats each
    // resulting word as an independent AND term. A quoted multi-word token
    // (e.g. `"fix bug"`) therefore matches as separate words rather than
    // an adjacent phrase, and a word with no ASCII whitespace (e.g.
    // Japanese text) matches as a substring.
    const words = freeText
      .split(/\s+/)
      .filter((word) => word !== '')
      .slice(0, MAX_FREE_TEXT_WORDS)
    const numberQuery = freeText.startsWith('#') ? freeText.slice(1) : freeText
    const numberCondition =
      numberQuery !== '' && /^\d+$/.test(numberQuery)
        ? sql`OR CAST(${tasks.number} AS TEXT) LIKE ${`${numberQuery}%`}`
        : sql``
    const wordConditions = words.map((word) => {
      const pattern = `%${word}%`
      return sql`(${tasks.title} ILIKE ${pattern} OR ${tasks.description} ILIKE ${pattern} OR EXISTS (SELECT 1 FROM ${taskPages} WHERE ${taskPages.taskId} = ${tasks.id} AND ${taskPages.content} ILIKE ${pattern}))`
    })
    conditions.push(sql`(${and(...wordConditions)} ${numberCondition})`)
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
