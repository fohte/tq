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
 * Shared by {@link getPageAuthors} and {@link getCommentAuthors}: the latest
 * edits row per distinct value of `targetColumn` (`edits.pageId` or
 * `edits.commentId`), via `DISTINCT ON` so Postgres returns one row per
 * target instead of the full history.
 */
async function getTargetAuthors(
  targetColumn: typeof edits.pageId | typeof edits.commentId,
  targetIds: string[],
): Promise<Map<string, EditAuthorInfo>> {
  if (targetIds.length === 0) return new Map()

  const rows = await db
    .selectDistinctOn([targetColumn], {
      targetId: targetColumn,
      authorKind: edits.authorKind,
      authorAgent: edits.authorAgent,
    })
    .from(edits)
    .where(inArray(targetColumn, targetIds))
    .orderBy(targetColumn, desc(edits.updatedAt))

  const authors = new Map<string, EditAuthorInfo>()
  for (const row of rows) {
    if (row.targetId != null) authors.set(row.targetId, toAuthorInfo(row))
  }
  return authors
}

/**
 * Author of each page's current content: the most recent edits row for that
 * pageId across create/update and any field, so an unedited page falls back
 * to its create row. Pages with no edits row (predating the edits table)
 * are absent from the returned map.
 */
export function getPageAuthors(
  pageIds: string[],
): Promise<Map<string, EditAuthorInfo>> {
  return getTargetAuthors(edits.pageId, pageIds)
}

/** Author of each comment's current content. Same rule as {@link getPageAuthors}. */
export function getCommentAuthors(
  commentIds: string[],
): Promise<Map<string, EditAuthorInfo>> {
  return getTargetAuthors(edits.commentId, commentIds)
}

/**
 * Per-field author for a task's title/description: the most recent `update`
 * row naming that field, falling back to the task's `create` row (recorded
 * with `field = null`) when the field was never updated after creation.
 * `DISTINCT ON (edits.field)` returns at most 3 rows (one each for `null`,
 * `'title'`, `'description'` — `'content'` never applies to a task-level
 * row), replacing a scan of the full history.
 */
export async function getTaskFieldAuthors(taskId: string): Promise<{
  title: EditAuthorInfo | null
  description: EditAuthorInfo | null
}> {
  const rows = await db
    .selectDistinctOn([edits.field], {
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
    .orderBy(edits.field, desc(edits.updatedAt))

  const byField = new Map(rows.map((row) => [row.field, toAuthorInfo(row)]))
  const createAuthor = byField.get(null) ?? null

  return {
    title: byField.get('title') ?? createAuthor,
    description: byField.get('description') ?? createAuthor,
  }
}
