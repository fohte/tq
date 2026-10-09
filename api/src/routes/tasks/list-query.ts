import {
  and,
  count,
  desc,
  eq,
  exists,
  getTableColumns,
  inArray,
  isNotNull,
  isNull,
  ne,
  notExists,
  or,
  sql,
} from 'drizzle-orm'
import { alias, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { z } from 'zod'

import { db } from '#db/connection'
import {
  labels,
  projects,
  taskComments,
  taskGithubLinks,
  taskLabels,
  taskPages,
  taskRelations,
  tasks,
} from '#db/schema'
import { classifyNumericOrId } from '#lib/numeric-id'
import { formatDateAtOffset } from '#lib/timezone'
import { buildTaskDateConditions } from '#routes/tasks/list-date-conditions'
import {
  followUpDueTaskWaitSubquery,
  unresolvedTaskWaitSubquery,
} from '#routes/tasks/list-query-waits'
import {
  buildTitleMatchCondition,
  queryTaskSearchMatches,
} from '#routes/tasks/search-match-query'
import {
  parentTasks,
  resolveTaskListOrderBy,
  resolveTasksByIdsOrNumbers,
  type TaskSearchMatch,
} from '#routes/tasks/shared'
import type { CountTasksQuery, ListTasksQuery } from '#schemas/task'
import { parseSearchQuery } from '#search-query-parser'

// Each word adds an EXISTS subquery for task_pages, so cap the word count
// to keep an adversarial `q` from generating an unbounded number of them.
const MAX_FREE_TEXT_WORDS = 20

const childTasks = alias(tasks, 'child_task')
const blockerTasks = alias(tasks, 'blocker_task')

function freeTextWords(freeText: string | undefined) {
  return (
    freeText
      ?.split(/\s+/)
      .filter((word) => word !== '')
      .slice(0, MAX_FREE_TEXT_WORDS) ?? []
  )
}

function taskNumberIdentifier(value: string | undefined) {
  return value != null &&
    isNumericTaskIdentifier(value) &&
    classifyNumericOrId(value).kind === 'number'
    ? value
    : undefined
}

function isNumericTaskIdentifier(value: string) {
  return /^\d+$/.test(value)
}

type ResolvedTaskFilter = { id: string | null }

type ResolvedTaskFilters = {
  parent: 'root' | ResolvedTaskFilter | undefined
  descendantOf: ResolvedTaskFilter | undefined
}

type TaskConditionsQuery = Omit<ListTasksQuery, 'limit' | 'view'>

// Extracted so `exists`/`notExists` can both wrap the same predicate for
// hasBlockers/hasNoBlockers without duplicating the join and where clause.
function unresolvedTaskBlockerSubquery() {
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

function unresolvedGithubBlockerSubquery() {
  return db
    .select({ _: sql`1` })
    .from(taskGithubLinks)
    .where(
      and(
        eq(taskGithubLinks.taskId, tasks.id),
        eq(taskGithubLinks.role, 'blocker'),
        eq(taskGithubLinks.state, 'open'),
      ),
    )
}

// NULL-safe "doesn't belong to this project", for a `projectId` column on
// `tasks` or its `parentTasks` self-join alias. A plain
// `not(eq(projectIdColumn, id))` would evaluate to NULL (not TRUE) when
// `projectIdColumn` is NULL, which would wrongly exclude project-less rows.
function projectMismatch(projectIdColumn: AnyPgColumn, identifier: string) {
  return z.uuid().safeParse(identifier).success
    ? or(isNull(projectIdColumn), ne(projectIdColumn, identifier))
    : notExists(
        db
          .select({ _: sql`1` })
          .from(projects)
          .where(
            and(
              eq(projects.id, projectIdColumn),
              eq(projects.title, identifier),
            ),
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

const { description: taskDescriptionColumn, ...taskRowColumns } =
  getTableColumns(tasks)
void taskDescriptionColumn

function selectTaskListRowsWithoutDescription() {
  return db
    .select({
      task: taskRowColumns,
      parentNumber: parentTasks.number,
    })
    .from(tasks)
    .leftJoin(parentTasks, eq(parentTasks.id, tasks.parentId))
}

export type TaskListRow = Awaited<ReturnType<typeof selectTaskListRows>>[number]
type TaskListRowWithoutDescription = Awaited<
  ReturnType<typeof selectTaskListRowsWithoutDescription>
>[number]

function buildConditions(
  query: Omit<TaskConditionsQuery, 'ids'>,
  ids: string[] | undefined,
  parsed: ReturnType<typeof parseSearchQuery> | null,
  resolvedFilters: ResolvedTaskFilters,
) {
  const conditions = []

  if (ids != null) {
    conditions.push(ids.length > 0 ? inArray(tasks.id, ids) : sql`false`)
  }

  const statuses = parsed?.status ?? query.status
  const taskStatuses = statuses.filter((status) => status !== 'all')
  if (taskStatuses.length > 0) {
    conditions.push(inArray(tasks.status, taskStatuses))
  }

  const context = parsed?.context ?? query.context
  if (context !== 'all') {
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
    // `labels.name` doubles as a `/`-separated path (e.g. `dev/tq`), so
    // `label:dev` also matches descendants like `dev/tq` via a literal
    // prefix check. `starts_with` does plain prefix comparison (unlike
    // LIKE), so a label name containing `%`/`_` can't be misread as a
    // wildcard.
    conditions.push(
      exists(
        db
          .select({ _: sql`1` })
          .from(taskLabels)
          .innerJoin(labels, eq(taskLabels.labelId, labels.id))
          .where(
            and(
              eq(taskLabels.taskId, tasks.id),
              or(
                eq(labels.name, labelName),
                sql`starts_with(${labels.name}, ${`${labelName}/`})`,
              ),
            ),
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
    conditions.push(
      or(
        exists(unresolvedTaskBlockerSubquery()),
        exists(unresolvedGithubBlockerSubquery()),
        exists(unresolvedTaskWaitSubquery()),
      ),
    )
  }

  if (parsed?.hasNoBlockers === true) {
    conditions.push(
      and(
        notExists(unresolvedTaskBlockerSubquery()),
        notExists(unresolvedGithubBlockerSubquery()),
        notExists(unresolvedTaskWaitSubquery()),
      ),
    )
  }

  if (parsed?.hasFollowUpDue === true) {
    conditions.push(
      exists(
        followUpDueTaskWaitSubquery(
          formatDateAtOffset(new Date(), query.tzOffset ?? 0),
        ),
      ),
    )
  }

  // Unlike the other filters above, an explicit `projectId` param wins over
  // one embedded in `q` — a route that pins its own scope (e.g.
  // /projects/$projectId) can't have that scope silently overridden by a
  // stray `project:` token typed into `q`.
  const projectIdentifier = query.projectId ?? parsed?.projectId

  const parent = resolvedFilters.parent
  if (parent === 'root') {
    // A task in this project whose actual parent belongs to a different
    // project (or none) has no visible parent within this project's task
    // list, so it needs to count as a root here too — otherwise it would
    // never appear anywhere in the project's tree.
    conditions.push(
      projectIdentifier != null
        ? or(
            isNull(tasks.parentId),
            projectMismatch(parentTasks.projectId, projectIdentifier),
          )
        : isNull(tasks.parentId),
    )
  } else if (parent != null) {
    conditions.push(
      parent.id == null ? sql`false` : eq(tasks.parentId, parent.id),
    )
  }

  if (query.templateId != null) {
    conditions.push(eq(tasks.templateId, query.templateId))
  }

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

  if (query.hasDue === true) {
    conditions.push(isNotNull(tasks.dueDate))
  } else if (query.hasDue === false) {
    conditions.push(isNull(tasks.dueDate))
  }

  conditions.push(...buildTaskDateConditions(query))

  if (parsed?.freeText != null && parsed.freeText !== '') {
    const freeText = parsed.freeText
    // `freeText` is `parseSearchQuery`'s tokens re-joined with spaces (see
    // search-query-parser.ts), so splitting on whitespace here treats each
    // resulting word as an independent AND term. A quoted multi-word token
    // (e.g. `"fix bug"`) therefore matches as separate words rather than
    // an adjacent phrase, and a word with no ASCII whitespace (e.g.
    // Japanese text) matches as a substring.
    const words = freeTextWords(freeText)
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
    const descendantId = resolvedFilters.descendantOf?.id
    conditions.push(
      descendantId == null
        ? sql`false`
        : sql`${tasks.id} IN (
            WITH RECURSIVE descendant_ids AS (
              SELECT id FROM ${tasks} WHERE parent_id = ${descendantId}
              UNION ALL
              SELECT t.id FROM ${tasks} t INNER JOIN descendant_ids d ON t.parent_id = d.id
            )
            SELECT id FROM descendant_ids
          )`,
    )
  }

  return {
    conditions,
    sortBy: parsed?.sortBy ?? query.sortBy,
    freeTextWords: freeTextWords(parsed?.freeText),
  }
}

async function buildTaskFilterConditions(query: TaskConditionsQuery) {
  const { ids: rawIds, ...filters } = query
  const parsed = query.q != null ? parseSearchQuery(query.q) : null
  const parentIdentifier = parsed?.parentId ?? filters.parentId
  const parentIdentifierString =
    parentIdentifier == null || parentIdentifier === 'root'
      ? undefined
      : String(parentIdentifier)
  const descendantIdentifierString =
    filters.descendantOf == null ? undefined : String(filters.descendantOf)
  const numericIdentifiers = [
    taskNumberIdentifier(parentIdentifierString),
    taskNumberIdentifier(descendantIdentifierString),
  ].filter((identifier): identifier is string => identifier != null)
  const resolvedFilterNumbers =
    await resolveTasksByIdsOrNumbers(numericIdentifiers)
  const resolveFilterIdentifier = (identifier: string | undefined) => {
    if (identifier == null) return undefined
    if (!isNumericTaskIdentifier(identifier)) return { id: identifier }
    return { id: resolvedFilterNumbers.byParam.get(identifier)?.id ?? null }
  }
  const resolvedFilters: ResolvedTaskFilters = {
    parent:
      parentIdentifier === 'root'
        ? 'root'
        : resolveFilterIdentifier(parentIdentifierString),
    descendantOf: resolveFilterIdentifier(descendantIdentifierString),
  }
  const ids =
    rawIds === undefined
      ? undefined
      : (await resolveTasksByIdsOrNumbers(rawIds.map(String))).ids

  return buildConditions(filters, ids, parsed, resolvedFilters)
}

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
