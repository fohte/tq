import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import type { DbTransaction } from '#db/connection'
import { edits } from '#db/schema'
import type { Author } from '#lib/author'

export type EditAuthor = Author | { kind: 'system'; agent: null }

export const SYSTEM_AUTHOR: EditAuthor = { kind: 'system', agent: null }

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
