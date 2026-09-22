import { and, desc, eq, type SQL, sql } from 'drizzle-orm'

import { db } from '#db/connection'
import { taskComments, taskPages, tasks } from '#db/schema'
import { parseSearchQuery } from '#search-query-parser'

const MAX_FREE_TEXT_WORDS = 20
const DEFAULT_LIMIT = 20
const SNIPPET_CONTEXT_LENGTH = 60
const SNIPPET_LENGTH = 160

export interface PageSearchResult {
  source: 'page' | 'comment' | 'task'
  taskNumber: number
  taskTitle: string
  pageId: string | null
  pageTitle: string | null
  snippet: string
  matchCount: number
  updatedAt: Date
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

function buildTermConditions(content: SQL, words: string[]) {
  return words.map((word) => {
    const pattern = `%${escapeLikePattern(word)}%`
    return sql`${content} ILIKE ${pattern} ESCAPE '\\'`
  })
}

function buildFirstMatchPosition(content: SQL, words: string[]) {
  return sql`least(${sql.join(
    words.map(
      (word) => sql`nullif(strpos(lower(${content}), lower(${word})), 0)`,
    ),
    sql`, `,
  )})`
}

function buildMatchCount(content: SQL, words: string[]) {
  const occurrenceCounts = words.map(
    (word) => sql`(
      char_length(lower(${content}))
      - char_length(replace(lower(${content}), lower(${word}), ''))
    ) / char_length(lower(${word}))`,
  )

  return sql<number>`(${sql.join(occurrenceCounts, sql` + `)})::integer`
}

function buildSnippet(content: SQL, words: string[]) {
  return sql<string>`substring(
    ${content}
    from greatest(
      ${buildFirstMatchPosition(content, words)} - ${SNIPPET_CONTEXT_LENGTH},
      1
    )
    for ${SNIPPET_LENGTH}
  )`
}

async function queryPageResults(words: string[]) {
  const content = sql`${taskPages.content}`

  return db
    .select({
      source: sql<'page'>`'page'`,
      taskNumber: tasks.number,
      taskTitle: tasks.title,
      pageId: taskPages.id,
      pageTitle: taskPages.title,
      snippet: buildSnippet(content, words),
      matchCount: buildMatchCount(content, words),
      updatedAt: taskPages.updatedAt,
    })
    .from(taskPages)
    .innerJoin(tasks, eq(taskPages.taskId, tasks.id))
    .where(and(...buildTermConditions(content, words)))
    .orderBy(desc(taskPages.updatedAt), taskPages.id)
}

async function queryCommentResults(words: string[]) {
  const content = sql`${taskComments.content}`

  return db
    .select({
      source: sql<'comment'>`'comment'`,
      taskNumber: tasks.number,
      taskTitle: tasks.title,
      pageId: sql<string | null>`null`,
      pageTitle: sql<string | null>`null`,
      snippet: buildSnippet(content, words),
      matchCount: buildMatchCount(content, words),
      updatedAt: taskComments.updatedAt,
    })
    .from(taskComments)
    .innerJoin(tasks, eq(taskComments.taskId, tasks.id))
    .where(and(...buildTermConditions(content, words)))
    .orderBy(desc(taskComments.updatedAt), taskComments.id)
}

async function queryTaskResults(words: string[]) {
  const content = sql`concat_ws(' ', ${tasks.title}, ${tasks.description})`

  return db
    .select({
      source: sql<'task'>`'task'`,
      taskNumber: tasks.number,
      taskTitle: tasks.title,
      pageId: sql<string | null>`null`,
      pageTitle: sql<string | null>`null`,
      snippet: buildSnippet(content, words),
      matchCount: buildMatchCount(content, words),
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .where(and(...buildTermConditions(content, words)))
    .orderBy(desc(tasks.updatedAt), tasks.id)
}

function compareResults(left: PageSearchResult, right: PageSearchResult) {
  return (
    right.updatedAt.getTime() - left.updatedAt.getTime() ||
    right.taskNumber - left.taskNumber ||
    left.source.localeCompare(right.source) ||
    (left.pageId ?? '').localeCompare(right.pageId ?? '')
  )
}

export async function queryPageSearch(query: {
  q: string
  limit?: number
}): Promise<PageSearchResult[]> {
  const freeText = parseSearchQuery(query.q).freeText
  const words = freeText
    .split(/\s+/)
    .filter((word) => word !== '')
    .slice(0, MAX_FREE_TEXT_WORDS)

  if (words.length === 0) return []

  const [pageResults, commentResults, taskResults] = await Promise.all([
    queryPageResults(words),
    queryCommentResults(words),
    queryTaskResults(words),
  ])

  return [...pageResults, ...commentResults, ...taskResults]
    .sort(compareResults)
    .slice(0, query.limit ?? DEFAULT_LIMIT)
}
