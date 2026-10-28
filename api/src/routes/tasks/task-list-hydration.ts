import { and, count, eq, inArray, sql } from 'drizzle-orm'

import { db } from '#db/connection'
import {
  labels,
  recurrenceRules,
  recurringTaskTemplates,
  taskGithubLinks,
  taskLabels,
  tasks,
} from '#db/schema'
import {
  type ChecklistCompletionCount,
  EMPTY_CHECKLIST_COMPLETION_COUNT,
  getChecklistCompletionCountsByTaskId,
} from '#routes/tasks/checklist-data'
import { taskCoreFieldsToResponse } from '#routes/tasks/task-response'
import {
  getOpenGithubBlockerRefsByTaskId,
  type GithubBlockerRef,
} from '#services/task-github-blockers'
import {
  getBlockedByNumbersByTaskId,
  getDuplicateOfNumbersByTaskId,
} from '#services/task-relations'
import {
  getVisibleTaskWaitSummariesByTaskId,
  type TaskWaitSummary,
} from '#services/task-waits'

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

// Batch-fetches recurrence rules keyed by rule id, for list endpoints that
// would otherwise issue one query per task to resolve `recurrenceRuleId`.
async function getRecurrenceRulesByIds(
  ruleIds: string[],
): Promise<Map<string, typeof recurrenceRules.$inferSelect>> {
  if (ruleIds.length === 0) return new Map()

  const rows = await db
    .select()
    .from(recurrenceRules)
    .where(inArray(recurrenceRules.id, ruleIds))

  return new Map(rows.map((row) => [row.id, row]))
}

// Batch-fetches recurrence rules for template-generated tasks (whose own
// recurrenceRuleId is null but whose templateId points at a template that
// owns a rule), keyed by templateId.
export async function getRecurrenceRulesByTemplateIds(
  templateIds: string[],
): Promise<Map<string, typeof recurrenceRules.$inferSelect>> {
  if (templateIds.length === 0) return new Map()

  const rows = await db
    .select({ templateId: recurringTaskTemplates.id, rule: recurrenceRules })
    .from(recurringTaskTemplates)
    .innerJoin(
      recurrenceRules,
      eq(recurringTaskTemplates.recurrenceRuleId, recurrenceRules.id),
    )
    .where(inArray(recurringTaskTemplates.id, templateIds))

  return new Map(rows.map((row) => [row.templateId, row.rule]))
}

// Batch-fetches GitHub links grouped by task ID, ordered by createdAt
// ascending; seq breaks ties (see its column comment).
export async function getGithubLinksByTaskId(
  taskIds: string[],
  options: { role?: (typeof taskGithubLinks.$inferSelect)['role'] } = {},
): Promise<Map<string, (typeof taskGithubLinks.$inferSelect)[]>> {
  if (taskIds.length === 0) return new Map()

  const rows = await db
    .select()
    .from(taskGithubLinks)
    .where(
      options.role == null
        ? inArray(taskGithubLinks.taskId, taskIds)
        : and(
            inArray(taskGithubLinks.taskId, taskIds),
            eq(taskGithubLinks.role, options.role),
          ),
    )
    .orderBy(taskGithubLinks.createdAt, taskGithubLinks.seq)

  const map = new Map<string, (typeof taskGithubLinks.$inferSelect)[]>()
  for (const row of rows) {
    const list = map.get(row.taskId) ?? []
    list.push(row)
    map.set(row.taskId, list)
  }
  return map
}

// Batch-fetches each task's full child completion count keyed by parent id,
// for list endpoints that would otherwise issue one query per task. Always
// counts every child of a task regardless of the caller's own predicate
// filters, since it's a fresh unfiltered query keyed only by parentId.
async function getChildCompletionCountsByTaskId(
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

// Shared response shape for the list-returning endpoint (`/api/tasks`).
function taskListItemFieldsToResponse(
  task: Omit<typeof tasks.$inferSelect, 'description'>,
  parentNumber: number | null,
  checklistCompletionCount: ChecklistCompletionCount,
  rule: typeof recurrenceRules.$inferSelect | null = null,
  githubLinks: (typeof taskGithubLinks.$inferSelect)[] = [],
  labelNames: string[] = [],
  duplicateOfNumber: number | null = null,
  blockedByNumbers: number[] = [],
  blockedByGithubRefs: GithubBlockerRef[] = [],
  waits: TaskWaitSummary[] = [],
) {
  return {
    ...taskCoreFieldsToResponse(task, rule, githubLinks, labelNames),
    parentNumber,
    duplicateOfNumber,
    blockedByNumbers,
    blockedByGithubRefs,
    ...(waits.length > 0 ? { waits } : {}),
    checklistCompletionCount,
  }
}

type TaskListItemFieldsResponse = ReturnType<
  typeof taskListItemFieldsToResponse
>
type TaskDescription = (typeof tasks.$inferSelect)['description']
type TaskListItemResponse = TaskListItemFieldsResponse & {
  description: TaskDescription
}
type TaskListItemRowResponse = TaskListItemFieldsResponse

type TaskListItemChildCompletionCount = {
  completed: number
  total: number
}
type TaskListItemWithChildCompletionCount = TaskListItemResponse & {
  childCompletionCount: TaskListItemChildCompletionCount
}
type TaskListRowWithChildCompletionCount = TaskListItemRowResponse & {
  childCompletionCount: TaskListItemChildCompletionCount
}

type TaskListHydrationRow = {
  task:
    typeof tasks.$inferSelect | Omit<typeof tasks.$inferSelect, 'description'>
  parentNumber: number | null
}

async function hydrateTaskListRowsWith<
  Row extends TaskListHydrationRow,
  Response,
>(
  rows: Row[],
  toResponse: (
    row: Row,
    fields: TaskListItemFieldsResponse,
    childCompletionCount: TaskListItemChildCompletionCount,
  ) => Response,
): Promise<Response[]> {
  const ids = rows.map((r) => r.task.id)
  const ruleIds = [
    ...new Set(
      rows.map((r) => r.task.recurrenceRuleId).filter((id) => id != null),
    ),
  ]
  const templateIds = [
    ...new Set(rows.map((r) => r.task.templateId).filter((id) => id != null)),
  ]
  const [
    labelsByTaskId,
    childCompletionCountsByTaskId,
    checklistCompletionCountsByTaskId,
    githubLinksByTaskId,
    duplicateOfNumbersByTaskId,
    blockedByNumbersByTaskId,
    openGithubBlockerRefsByTaskId,
    waitsByTaskId,
    recurrenceRulesById,
    recurrenceRulesByTemplateId,
  ] = await Promise.all([
    getLabelNamesByTaskId(ids),
    getChildCompletionCountsByTaskId(ids),
    getChecklistCompletionCountsByTaskId(ids),
    getGithubLinksByTaskId(ids, { role: 'subject' }),
    getDuplicateOfNumbersByTaskId(ids),
    getBlockedByNumbersByTaskId(ids),
    getOpenGithubBlockerRefsByTaskId(ids),
    getVisibleTaskWaitSummariesByTaskId(ids),
    getRecurrenceRulesByIds(ruleIds),
    getRecurrenceRulesByTemplateIds(templateIds),
  ])

  return rows.map((r) => {
    const itemFields = taskListItemFieldsToResponse(
      r.task,
      r.parentNumber,
      checklistCompletionCountsByTaskId.get(r.task.id) ??
        EMPTY_CHECKLIST_COMPLETION_COUNT,
      r.task.templateId != null
        ? (recurrenceRulesByTemplateId.get(r.task.templateId) ?? null)
        : r.task.recurrenceRuleId != null
          ? (recurrenceRulesById.get(r.task.recurrenceRuleId) ?? null)
          : null,
      githubLinksByTaskId.get(r.task.id) ?? [],
      labelsByTaskId.get(r.task.id) ?? [],
      r.task.statusReason === 'duplicate'
        ? (duplicateOfNumbersByTaskId.get(r.task.id) ?? null)
        : null,
      blockedByNumbersByTaskId.get(r.task.id) ?? [],
      openGithubBlockerRefsByTaskId.get(r.task.id) ?? [],
      waitsByTaskId.get(r.task.id) ?? [],
    )
    const childCompletionCount = childCompletionCountsByTaskId.get(
      r.task.id,
    ) ?? {
      completed: 0,
      total: 0,
    }

    return toResponse(r, itemFields, childCompletionCount)
  })
}

// Batch-hydrates full list-query rows into full responses with a fixed number
// of queries regardless of row count.
export function hydrateTaskListRows(
  rows: {
    task: typeof tasks.$inferSelect
    parentNumber: number | null
  }[],
): Promise<TaskListItemWithChildCompletionCount[]> {
  return hydrateTaskListRowsWith(rows, (row, fields, childCompletionCount) => ({
    ...fields,
    description: row.task.description,
    childCompletionCount,
  }))
}

// Batch-hydrates row list-query rows into responses without descriptions.
export function hydrateTaskListRowsWithoutDescription(
  rows: {
    task: Omit<typeof tasks.$inferSelect, 'description'>
    parentNumber: number | null
  }[],
): Promise<TaskListRowWithChildCompletionCount[]> {
  return hydrateTaskListRowsWith(
    rows,
    (_row, fields, childCompletionCount) => ({
      ...fields,
      childCompletionCount,
    }),
  )
}
