import { and, desc, inArray, or, type SQL, sql } from 'drizzle-orm'

import { db } from '#db/connection'
import { taskPages, tasks } from '#db/schema'
import { buildSnippet } from '#routes/tasks/page-search-query'
import type { TaskSearchMatch } from '#routes/tasks/shared'

type SearchTaskRow = { task: { id: string; title: string } }

function buildAnyWordCondition(content: SQL, words: string[]) {
  // Keep wildcard semantics aligned with the task-list free-text predicate.
  return (
    or(...words.map((word) => sql`${content} ILIKE ${`%${word}%`}`)) ??
    sql`false`
  )
}

function buildAllWordCondition(content: SQL, words: string[]) {
  return (
    and(...words.map((word) => sql`${content} ILIKE ${`%${word}%`}`)) ??
    sql`true`
  )
}

export function buildTitleMatchCondition(words: string[]) {
  return buildAllWordCondition(sql`${tasks.title}`, words)
}

export async function queryTaskSearchMatches(
  rows: SearchTaskRow[],
  words: string[],
): Promise<Map<string, TaskSearchMatch>> {
  const taskIds = rows.map((row) => row.task.id)
  if (taskIds.length === 0 || words.length === 0) return new Map()

  const titleMatches = await db
    .select({ taskId: tasks.id })
    .from(tasks)
    .where(and(inArray(tasks.id, taskIds), buildTitleMatchCondition(words)))
  const matches = new Map<string, TaskSearchMatch>()
  const titleMatchIds = new Set(titleMatches.map((row) => row.taskId))
  for (const row of rows) {
    if (titleMatchIds.has(row.task.id)) {
      matches.set(row.task.id, { field: 'title', snippet: row.task.title })
    }
  }

  const bodyTaskIds = taskIds.filter((id) => !titleMatchIds.has(id))
  if (bodyTaskIds.length === 0) return matches

  const descriptionContent = sql`${tasks.description}`
  const descriptionMatches = await db
    .select({
      taskId: tasks.id,
      snippet: sql<string>`coalesce(
        ${buildSnippet(descriptionContent, words)},
        substring(${descriptionContent} from 1 for 160)
      )`,
    })
    .from(tasks)
    .where(
      and(
        inArray(tasks.id, bodyTaskIds),
        buildAnyWordCondition(descriptionContent, words),
      ),
    )
  for (const row of descriptionMatches) {
    matches.set(row.taskId, { field: 'description', snippet: row.snippet })
  }

  const pageTaskIds = bodyTaskIds.filter((id) => !matches.has(id))
  if (pageTaskIds.length === 0) return matches

  const pageContent = sql`${taskPages.content}`
  const pageMatches = await db
    .selectDistinctOn([taskPages.taskId], {
      taskId: taskPages.taskId,
      pageTitle: taskPages.title,
      snippet: sql<string>`coalesce(
        ${buildSnippet(pageContent, words)},
        substring(${pageContent} from 1 for 160)
      )`,
    })
    .from(taskPages)
    .where(
      and(
        inArray(taskPages.taskId, pageTaskIds),
        buildAnyWordCondition(pageContent, words),
      ),
    )
    .orderBy(taskPages.taskId, desc(taskPages.updatedAt), taskPages.id)
  for (const row of pageMatches) {
    matches.set(row.taskId, {
      field: 'page',
      pageTitle: row.pageTitle,
      snippet: row.snippet,
    })
  }

  return matches
}
