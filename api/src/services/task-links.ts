import { eq, inArray, sql } from 'drizzle-orm'

import { MENTION_PATTERN } from '#constants/mention-pattern'
import { db } from '#db/connection'
import { taskComments, taskLinks, taskPages, tasks } from '#db/schema'

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
  await db.transaction(async (tx) => {
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
        .select({ content: taskPages.content, format: taskPages.format })
        .from(taskPages)
        .where(eq(taskPages.taskId, sourceTaskId)),
      tx
        .select({ content: taskComments.content })
        .from(taskComments)
        .where(eq(taskComments.taskId, sourceTaskId)),
    ])

    // The task may already be gone (e.g. deleted concurrently); its links
    // were removed by the FK cascade, so there's nothing left to sync.
    if (!task) return

    // HTML pages are excluded: their markup can contain numeric character
    // references (e.g. `&#47;`) that MENTION_PATTERN would misread as a task
    // mention.
    const texts = [
      task.description ?? '',
      ...pages.filter((p) => p.format !== 'html').map((p) => p.content),
      ...comments.map((c) => c.content),
    ]
    const mentionedNumbers = new Set(texts.flatMap(extractMentionedNumbers))
    mentionedNumbers.delete(task.number)

    const targets =
      mentionedNumbers.size > 0
        ? await tx
            .select({ id: tasks.id })
            .from(tasks)
            .where(inArray(tasks.number, [...mentionedNumbers]))
        : []

    await tx.delete(taskLinks).where(eq(taskLinks.sourceTaskId, sourceTaskId))
    if (targets.length > 0) {
      await tx
        .insert(taskLinks)
        .values(targets.map((t) => ({ sourceTaskId, targetTaskId: t.id })))
    }
  })
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
