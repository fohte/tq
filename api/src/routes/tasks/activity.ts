import { and, asc, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { edits, taskEvents } from '#db/schema'
import type { EditAuthorInfo } from '#lib/edits'
import { requireTask } from '#routes/tasks/shared'
import type { TaskStatusReason } from '#schemas/task'

type ActivityAuthor = EditAuthorInfo

type ActivityItem =
  | { id: string; type: 'created'; createdAt: string; author: ActivityAuthor }
  | {
      id: string
      type: 'status_changed'
      createdAt: string
      author: ActivityAuthor
      fromStatus: 'todo' | 'in_progress' | 'completed'
      toStatus: 'todo' | 'in_progress' | 'completed'
      toStatusReason: TaskStatusReason | null
    }
  | {
      id: string
      type: 'github_linked' | 'github_unlinked'
      createdAt: string
      author: ActivityAuthor
      owner: string
      repo: string
      number: number
      kind: 'issue' | 'pull_request'
    }

function taskEventToActivityItem(
  row: typeof taskEvents.$inferSelect,
): ActivityItem | null {
  const author: ActivityAuthor = {
    kind: row.authorKind,
    agent: row.authorAgent,
  }
  const base = {
    id: `event-${String(row.id)}`,
    createdAt: row.createdAt.toISOString(),
    author,
  }

  if (row.type === 'status_changed') {
    // Guaranteed non-null by the task_events_payload_check constraint.
    if (row.fromStatus == null || row.toStatus == null) return null
    return {
      ...base,
      type: 'status_changed',
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      toStatusReason: row.toStatusReason,
    }
  }

  // Guaranteed non-null by the task_events_payload_check constraint.
  if (
    row.githubOwner == null ||
    row.githubRepo == null ||
    row.githubNumber == null ||
    row.githubKind == null
  ) {
    return null
  }
  return {
    ...base,
    type: row.type,
    owner: row.githubOwner,
    repo: row.githubRepo,
    number: row.githubNumber,
    kind: row.githubKind,
  }
}

export const tasksActivityApp = new Hono().get(
  '/:id/activity',
  requireTask,
  async (c) => {
    const task = c.get('task')

    const [createEditRows, eventRows] = await Promise.all([
      db
        .select()
        .from(edits)
        .where(
          and(
            eq(edits.taskId, task.id),
            eq(edits.action, 'create'),
            isNull(edits.pageId),
            isNull(edits.commentId),
          ),
        )
        .orderBy(asc(edits.id)),
      db
        .select()
        .from(taskEvents)
        .where(eq(taskEvents.taskId, task.id))
        .orderBy(asc(taskEvents.id)),
    ])

    const items: ActivityItem[] = [
      ...createEditRows.map((row): ActivityItem => ({
        id: `edit-${String(row.id)}`,
        type: 'created',
        createdAt: row.createdAt.toISOString(),
        author: { kind: row.authorKind, agent: row.authorAgent },
      })),
      ...eventRows
        .map(taskEventToActivityItem)
        .filter((item): item is ActivityItem => item != null),
    ]

    items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    return c.json(items, 200)
  },
)
