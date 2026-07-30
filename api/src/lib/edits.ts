import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

import { db, type DbTransaction } from '#db/connection'
import { edits } from '#db/schema'
import type { Author } from '#lib/author'

export type EditAuthor = Author | { kind: 'system'; agent: null }

export const SYSTEM_AUTHOR: EditAuthor = { kind: 'system', agent: null }

// What GET responses expose: who most recently wrote the current content.
// Unlike `EditAuthor`, callers never construct this directly — it's always
// read back from an `edits` row via the lookups below.
export type EditAuthorInfo = { kind: EditAuthor['kind']; agent: string | null }

export type EditTarget = {
  taskId: string
  pageId?: string | null
  commentId?: string | null
}

export type EditActionInput =
  | { action: 'create' }
  | { action: 'update'; field: 'title' | 'description' | 'content' }

const AGGREGATION_WINDOW_MS = 10 * 60 * 1000

/**
 * Returns which of `fields` actually changed: present in `input` (not
 * `undefined`, i.e. the client touched it) and different from `existing`.
 */
export function diffFields<T, K extends keyof T & string>(
  existing: T,
  input: Partial<Record<K, T[K] | undefined>>,
  fields: readonly K[],
): K[] {
  return fields.filter(
    (field) => input[field] !== undefined && input[field] !== existing[field],
  )
}

/**
 * Records who wrote what, in the same transaction as the write itself.
 * Consecutive edits to the same target/field/author within a 10-minute
 * window are collapsed into one row (bumping its updatedAt) instead of
 * appending a new one, so debounced autosaves don't flood the log.
 */
export async function recordEdit(
  tx: DbTransaction,
  target: EditTarget,
  actionInput: EditActionInput,
  author: EditAuthor,
): Promise<void> {
  const field = actionInput.action === 'create' ? null : actionInput.field
  const pageId = target.pageId ?? null
  const commentId = target.commentId ?? null

  // Serializes concurrent recordEdit calls for the same aggregation key so
  // the check-then-act below can't race (e.g. two requests both seeing "no
  // recent row" and both inserting). Scoped to the transaction, so it's
  // released automatically on commit or rollback.
  const lockKey = [
    target.taskId,
    pageId ?? '',
    commentId ?? '',
    field ?? '',
    author.kind,
    author.agent ?? '',
  ].join('')
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`)

  const [latest] = await tx
    .select({ id: edits.id, updatedAt: edits.updatedAt })
    .from(edits)
    .where(
      and(
        eq(edits.taskId, target.taskId),
        field == null ? isNull(edits.field) : eq(edits.field, field),
        pageId == null ? isNull(edits.pageId) : eq(edits.pageId, pageId),
        commentId == null
          ? isNull(edits.commentId)
          : eq(edits.commentId, commentId),
        eq(edits.authorKind, author.kind),
        author.agent == null
          ? isNull(edits.authorAgent)
          : eq(edits.authorAgent, author.agent),
      ),
    )
    .orderBy(desc(edits.updatedAt))
    .limit(1)

  const now = new Date()
  if (
    latest != null &&
    now.getTime() - latest.updatedAt.getTime() <= AGGREGATION_WINDOW_MS
  ) {
    await tx
      .update(edits)
      .set({ updatedAt: now })
      .where(eq(edits.id, latest.id))
    return
  }

  await tx.insert(edits).values({
    taskId: target.taskId,
    pageId,
    commentId,
    action: actionInput.action,
    field,
    authorKind: author.kind,
    authorAgent: author.agent,
  })
}

function toAuthorInfo(row: {
  authorKind: EditAuthor['kind']
  authorAgent: string | null
}): EditAuthorInfo {
  return { kind: row.authorKind, agent: row.authorAgent }
}

/**
 * Author of each page's current content: the most recent edits row for that
 * pageId across create/update and any field, so an unedited page falls back
 * to its create row. Pages with no edits row (predating the edits table)
 * are absent from the returned map.
 */
export async function getPageAuthors(
  pageIds: string[],
): Promise<Map<string, EditAuthorInfo>> {
  if (pageIds.length === 0) return new Map()

  const rows = await db
    .select({
      pageId: edits.pageId,
      authorKind: edits.authorKind,
      authorAgent: edits.authorAgent,
    })
    .from(edits)
    .where(inArray(edits.pageId, pageIds))
    .orderBy(desc(edits.updatedAt))

  const authors = new Map<string, EditAuthorInfo>()
  for (const row of rows) {
    if (row.pageId != null && !authors.has(row.pageId)) {
      authors.set(row.pageId, toAuthorInfo(row))
    }
  }
  return authors
}

/** Author of each comment's current content. Same rule as {@link getPageAuthors}. */
export async function getCommentAuthors(
  commentIds: string[],
): Promise<Map<string, EditAuthorInfo>> {
  if (commentIds.length === 0) return new Map()

  const rows = await db
    .select({
      commentId: edits.commentId,
      authorKind: edits.authorKind,
      authorAgent: edits.authorAgent,
    })
    .from(edits)
    .where(inArray(edits.commentId, commentIds))
    .orderBy(desc(edits.updatedAt))

  const authors = new Map<string, EditAuthorInfo>()
  for (const row of rows) {
    if (row.commentId != null && !authors.has(row.commentId)) {
      authors.set(row.commentId, toAuthorInfo(row))
    }
  }
  return authors
}

/**
 * Per-field author for a task's title/description: the most recent `update`
 * row naming that field, falling back to the task's `create` row when the
 * field was never updated after creation. A field is `null` here only when
 * it predates the edits table.
 */
export async function getTaskFieldAuthors(taskId: string): Promise<{
  title: EditAuthorInfo | null
  description: EditAuthorInfo | null
}> {
  const rows = await db
    .select({
      action: edits.action,
      field: edits.field,
      authorKind: edits.authorKind,
      authorAgent: edits.authorAgent,
    })
    .from(edits)
    .where(
      and(
        eq(edits.taskId, taskId),
        isNull(edits.pageId),
        isNull(edits.commentId),
      ),
    )
    .orderBy(desc(edits.updatedAt))

  let title: EditAuthorInfo | null = null
  let description: EditAuthorInfo | null = null
  let createAuthor: EditAuthorInfo | null = null

  for (const row of rows) {
    if (row.field === 'title' && title == null) title = toAuthorInfo(row)
    if (row.field === 'description' && description == null) {
      description = toAuthorInfo(row)
    }
    if (row.action === 'create' && createAuthor == null) {
      createAuthor = toAuthorInfo(row)
    }
  }

  return {
    title: title ?? createAuthor,
    description: description ?? createAuthor,
  }
}
