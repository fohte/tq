import { eq, sql } from 'drizzle-orm'

import { db } from '#db/connection'
import { taskComments, taskLinks, taskPages, tasks } from '#db/schema'
import { matchByIdOrNumber } from '#lib/drizzle-utils'
import type { NumericOrId } from '#lib/numeric-id'
import { selectTaskListRows } from '#routes/tasks/list-query'
import {
  hydrateTaskListRows,
  type TaskListItemResponse,
} from '#routes/tasks/shared'
import {
  dedupeRefs,
  extractMentionedTaskRefs,
} from '#services/task-link-references'

interface LinkedTaskSummary {
  id: string
  number: number
  title: string
  status: 'todo' | 'completed'
}

// Shared with other task-join queries (e.g. agent session links) that need
// the same lightweight task shape without pulling every task column.
export const taskSummaryColumns = {
  id: tasks.id,
  number: tasks.number,
  title: tasks.title,
  status: tasks.status,
}

type RefSource =
  | { kind: 'description' }
  | { kind: 'page'; id: string; title: string }
  | { kind: 'comment'; id: string }

type UnresolvedRef = NumericOrId & { sources: RefSource[] }

export interface TaskLinkSyncResult {
  outgoing: LinkedTaskSummary[]
  // Refs extracted from the synced text that didn't match any existing task.
  unresolvedRefs: UnresolvedRef[]
}

// Recomputes every outgoing link for `sourceTaskId` from scratch by
// re-scanning all of its body text (description + pages + comments), since a
// mention can be removed from one field while still present in another.
export async function syncTaskLinks(
  sourceTaskId: string,
): Promise<TaskLinkSyncResult> {
  return db.transaction(async (tx) => {
    // Serializes concurrent syncs for the same source: without this, two
    // requests racing to resync the same task (e.g. two near-simultaneous
    // description PATCHes) can each delete every existing link and then
    // both insert, colliding on the (source_task_id, target_task_id)
    // primary key. Scoped to the transaction, so it's released
    // automatically on commit or rollback.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${sourceTaskId}))`,
    )

    const [task, pages, comments] = await Promise.all([
      tx.query.tasks.findFirst({ where: eq(tasks.id, sourceTaskId) }),
      tx
        .select({
          id: taskPages.id,
          title: taskPages.title,
          content: taskPages.content,
          format: taskPages.format,
        })
        .from(taskPages)
        .where(eq(taskPages.taskId, sourceTaskId)),
      tx
        .select({ id: taskComments.id, content: taskComments.content })
        .from(taskComments)
        .where(eq(taskComments.taskId, sourceTaskId)),
    ])

    // The task may already be gone (e.g. deleted concurrently); its links
    // were removed by the FK cascade, so there's nothing left to sync.
    if (!task) return { outgoing: [], unresolvedRefs: [] }

    // HTML pages are excluded: their markup can contain numeric character
    // references (e.g. `&#47;`) that MENTION_PATTERN would misread as a task
    // mention.
    const fields: { source: RefSource; text: string }[] = [
      { source: { kind: 'description' }, text: task.description ?? '' },
      ...pages
        .filter((p) => p.format !== 'html')
        .map((p) => ({
          source: { kind: 'page' as const, id: p.id, title: p.title },
          text: p.content,
        })),
      ...comments.map((c) => ({
        source: { kind: 'comment' as const, id: c.id },
        text: c.content,
      })),
    ]
    // Each field is parsed separately (not joined into one string first):
    // joining would let e.g. an unterminated inline-code backtick ending one
    // field pair up with a closing backtick that starts the next, masking a
    // real mention in the next field as code (see the "unterminated
    // backtick" case in task-links.integration.test.ts). Refs are still
    // deduped across fields via `dedupeRefs`, not just within each one.
    const fieldRefs = await Promise.all(
      fields.map(async (field) => ({
        source: field.source,
        refs: await extractMentionedTaskRefs(field.text),
      })),
    )
    const refs = dedupeRefs(fieldRefs.flatMap((f) => f.refs)).filter((ref) =>
      ref.kind === 'number'
        ? ref.value !== task.number
        : ref.value !== sourceTaskId,
    )

    const targets =
      refs.length > 0
        ? await tx
            .select(taskSummaryColumns)
            .from(tasks)
            .where(matchByIdOrNumber(tasks, refs))
        : []

    await tx.delete(taskLinks).where(eq(taskLinks.sourceTaskId, sourceTaskId))
    if (targets.length > 0) {
      await tx
        .insert(taskLinks)
        .values(targets.map((t) => ({ sourceTaskId, targetTaskId: t.id })))
    }

    const resolvedNumbers = new Set(targets.map((t) => t.number))
    const resolvedIds = new Set(targets.map((t) => t.id))
    const unresolvedRefs: UnresolvedRef[] = refs
      .filter((ref) =>
        ref.kind === 'number'
          ? !resolvedNumbers.has(ref.value)
          : !resolvedIds.has(ref.value),
      )
      .map((ref) => ({
        ...ref,
        sources: fieldRefs
          .filter((f) =>
            f.refs.some((r) => r.kind === ref.kind && r.value === ref.value),
          )
          .map((f) => f.source),
      }))

    return {
      outgoing: [...targets].sort((a, b) => a.number - b.number),
      unresolvedRefs,
    }
  })
}

// The task-detail page renders linked tasks with the same row appearance as
// every other task list, so this carries the full list-item shape rather
// than the minimal `LinkedTaskSummary` used for a link-sync result.
type LinkedTaskDetail = TaskListItemResponse & {
  childCompletionCount: { completed: number; total: number }
}

export interface TaskLinks {
  outgoing: LinkedTaskDetail[]
  incoming: LinkedTaskDetail[]
}

export async function getTaskLinks(taskId: string): Promise<TaskLinks> {
  const [outgoingRows, incomingRows] = await Promise.all([
    selectTaskListRows()
      .innerJoin(taskLinks, eq(taskLinks.targetTaskId, tasks.id))
      .where(eq(taskLinks.sourceTaskId, taskId))
      .orderBy(tasks.number),
    selectTaskListRows()
      .innerJoin(taskLinks, eq(taskLinks.sourceTaskId, tasks.id))
      .where(eq(taskLinks.targetTaskId, taskId))
      .orderBy(tasks.number),
  ])

  // Hydrated together (not per-direction) so labels and progress counts are
  // fetched in a fixed number of queries regardless of link direction.
  const hydrated = await hydrateTaskListRows([...outgoingRows, ...incomingRows])

  return {
    outgoing: hydrated.slice(0, outgoingRows.length),
    incoming: hydrated.slice(outgoingRows.length),
  }
}
