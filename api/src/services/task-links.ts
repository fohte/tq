import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { eq, sql } from 'drizzle-orm'

import { MENTION_PATTERN } from '#constants/mention-pattern'
import { db } from '#db/connection'
import { taskComments, taskLinks, taskPages, tasks } from '#db/schema'
import { APP_DOMAIN } from '#env'
import { extractAppResourceRefs } from '#lib/app-url'
import { matchByIdOrNumber } from '#lib/drizzle-utils'
import { parseMarkdown } from '#lib/markdown-parser'
import type { NumericOrId } from '#lib/numeric-id'
import { collectTextBlockRuns } from '#lib/text-scan'

// Only safe to run against a single textblock run's masked text (see
// `extractMentionedTaskRefs` below) — a raw markdown string can still
// contain `#123` inside a code span or a link's display text, which isn't a
// real reference.
export function extractMentionedNumbers(text: string): number[] {
  const numbers = new Set<number>()
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const [, digits] = match
    if (digits != null) numbers.add(Number(digits))
  }
  return [...numbers]
}

// Shared by `extractMentionedTaskRefs` (within one field) and `syncTaskLinks`
// (across a task's fields) so both dedupe refs the same way regardless of
// how many source texts they were scanned from.
function dedupeRefs(refs: Iterable<NumericOrId>): NumericOrId[] {
  const numbers = new Set<number>()
  const ids = new Set<string>()
  for (const ref of refs) {
    if (ref.kind === 'number') {
      numbers.add(ref.value)
    } else {
      ids.add(ref.value)
    }
  }
  return [
    ...[...numbers].map((value): NumericOrId => ({ kind: 'number', value })),
    ...[...ids].map((value): NumericOrId => ({ kind: 'id', value })),
  ]
}

// Combines `#123`-style mentions with `https://<APP_DOMAIN>/tasks/...`-style
// URLs pasted into task text. A task URL may key off either the human-facing
// number or the UUID primary key (see `findTaskByIdOrNumber`), so a numeric
// URL ref is folded in alongside `#123` mentions as the same `kind: 'number'`.
//
// Parses `text` into the same ProseMirror doc shape the frontend editor
// produces and runs the regex matchers per textblock run rather than against
// the raw string, so a `#123` inside a code span, a code block, or a link's
// display text (masked by `collectTextBlockRuns`, shared with `web` via the
// `api` package) is excluded the same way it is in the editor.
export async function extractMentionedTaskRefs(
  text: string,
): Promise<NumericOrId[]> {
  const parsed = await parseMarkdown(text)
  if (parsed.isErr()) {
    // A pathological field (e.g. deeply nested blockquotes) must not turn an
    // otherwise-successful task/page/comment write into a failed sync — this
    // field just contributes no refs.
    captureWithFingerprint(parsed.error, 'api.task-links.parse-failed')
    return []
  }
  const doc = parsed.value
  const refs: NumericOrId[] = []
  for (const run of collectTextBlockRuns(doc)) {
    for (const value of extractMentionedNumbers(run.text)) {
      refs.push({ kind: 'number', value })
    }
    for (const ref of extractAppResourceRefs(run.text, APP_DOMAIN, 'tasks')) {
      refs.push(ref)
    }
  }
  return dedupeRefs(refs)
}

export interface LinkedTaskSummary {
  id: string
  number: number
  title: string
  status: 'todo' | 'in_progress' | 'completed'
}

// Shared with other task-join queries (e.g. agent session links) that need
// the same lightweight task shape without pulling every task column.
export const taskSummaryColumns = {
  id: tasks.id,
  number: tasks.number,
  title: tasks.title,
  status: tasks.status,
}

// Identifies which body field a ref was found in, so the write-time summary
// (see `cli/src/output.ts#printLinkSync`) can tell the writer where to look
// instead of just naming the ref.
export type RefSource =
  | { kind: 'description' }
  | { kind: 'page'; id: string; title: string }
  | { kind: 'comment'; id: string }

export type UnresolvedRef = NumericOrId & { sources: RefSource[] }

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

export interface TaskLinks {
  outgoing: LinkedTaskSummary[]
  incoming: LinkedTaskSummary[]
}

export async function getTaskLinks(taskId: string): Promise<TaskLinks> {
  const [outgoing, incoming] = await Promise.all([
    db
      .select(taskSummaryColumns)
      .from(taskLinks)
      .innerJoin(tasks, eq(tasks.id, taskLinks.targetTaskId))
      .where(eq(taskLinks.sourceTaskId, taskId))
      .orderBy(tasks.number),
    db
      .select(taskSummaryColumns)
      .from(taskLinks)
      .innerJoin(tasks, eq(tasks.id, taskLinks.sourceTaskId))
      .where(eq(taskLinks.targetTaskId, taskId))
      .orderBy(tasks.number),
  ])

  return { outgoing, incoming }
}
