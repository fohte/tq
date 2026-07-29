import { eq, inArray } from 'drizzle-orm'

import { db } from '#db/connection'
import { taskComments, taskLinks, taskPages, tasks } from '#db/schema'

// Requires a non-word, non-`#` character (or string start) before the `#` and
// forbids a trailing word character, so `#123` matches but `foo#123`,
// `##123`, and `#123abc` don't.
const MENTION_PATTERN = /(?<![\w#])#(\d+)(?!\w)/g

export function extractMentionedNumbers(text: string): number[] {
  const numbers = new Set<number>()
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const [, digits] = match
    if (digits != null) numbers.add(Number(digits))
  }
  return [...numbers]
}

// Recomputes every outgoing link for `sourceTaskId` from scratch by
// re-scanning all of its body text (description + pages + comments), since a
// mention can be removed from one field while still present in another.
export async function syncTaskLinks(sourceTaskId: string): Promise<void> {
  const [task, pages, comments] = await Promise.all([
    db.query.tasks.findFirst({ where: eq(tasks.id, sourceTaskId) }),
    db
      .select({ content: taskPages.content })
      .from(taskPages)
      .where(eq(taskPages.taskId, sourceTaskId)),
    db
      .select({ content: taskComments.content })
      .from(taskComments)
      .where(eq(taskComments.taskId, sourceTaskId)),
  ])

  // The task may already be gone (e.g. deleted concurrently); its links were
  // removed by the FK cascade, so there's nothing left to sync.
  if (!task) return

  const texts = [
    task.description ?? '',
    ...pages.map((p) => p.content),
    ...comments.map((c) => c.content),
  ]
  const mentionedNumbers = new Set(texts.flatMap(extractMentionedNumbers))
  mentionedNumbers.delete(task.number)

  const targets =
    mentionedNumbers.size > 0
      ? await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(inArray(tasks.number, [...mentionedNumbers]))
      : []

  // No transaction here: the codebase has no `db.transaction` usage anywhere
  // (see other multi-statement routes, e.g. `tasks/crud.ts`'s DELETE
  // handler), and the test harness (`#testing`) wraps each test in its own
  // manual BEGIN/ROLLBACK on a single pooled connection, which a nested
  // `db.transaction` would prematurely commit.
  await db.delete(taskLinks).where(eq(taskLinks.sourceTaskId, sourceTaskId))
  if (targets.length > 0) {
    await db
      .insert(taskLinks)
      .values(targets.map((t) => ({ sourceTaskId, targetTaskId: t.id })))
  }
}

export interface LinkedTaskSummary {
  id: string
  number: number
  title: string
  status: 'todo' | 'in_progress' | 'completed'
}

export interface TaskLinks {
  outgoing: LinkedTaskSummary[]
  incoming: LinkedTaskSummary[]
}

export async function getTaskLinks(taskId: string): Promise<TaskLinks> {
  const summaryColumns = {
    id: tasks.id,
    number: tasks.number,
    title: tasks.title,
    status: tasks.status,
  }

  const [outgoing, incoming] = await Promise.all([
    db
      .select(summaryColumns)
      .from(taskLinks)
      .innerJoin(tasks, eq(tasks.id, taskLinks.targetTaskId))
      .where(eq(taskLinks.sourceTaskId, taskId))
      .orderBy(tasks.number),
    db
      .select(summaryColumns)
      .from(taskLinks)
      .innerJoin(tasks, eq(tasks.id, taskLinks.sourceTaskId))
      .where(eq(taskLinks.targetTaskId, taskId))
      .orderBy(tasks.number),
  ])

  return { outgoing, incoming }
}
