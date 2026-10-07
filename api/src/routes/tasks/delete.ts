import { eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { tasks } from '#db/schema'
import { setChangeEventTaskIds } from '#lib/change-events'
import {
  getTaskChangeEventIds,
  getTaskChecklistOwnerIds,
} from '#routes/tasks/change-event-task-ids'
import { requireTask } from '#routes/tasks/shared'
import { deleteRecurrenceRuleIfUnreferenced } from '#services/recurrence-rule-cleanup'

export const tasksDeleteApp = new Hono().delete(
  '/:id',
  requireTask,
  async (c) => {
    const existing = c.get('task')
    const id = existing.id
    const relatedTaskIdsBefore = await getTaskChangeEventIds([id])
    const checklistOwnerIds = await getTaskChecklistOwnerIds(id)

    const reparentedChildIds = await db.transaction(async (tx) => {
      // Reparent children to the deleted task's parent (or top-level if
      // none) before deleting, so the tree structure above the deleted task
      // is preserved. The parent is re-read from the row here rather than
      // taken from `existing` so a concurrent delete of an ancestor (which
      // takes the same row lock via its own reparent update) can't leave
      // this pointing at an already-deleted parent.
      const reparentedChildren = await tx
        .update(tasks)
        .set({
          parentId: sql`(select ${tasks.parentId} from ${tasks} where ${tasks.id} = ${id})`,
          updatedAt: new Date(),
        })
        .where(eq(tasks.parentId, id))
        .returning({ id: tasks.id })

      await tx.delete(tasks).where(eq(tasks.id, id))

      // Clean up orphaned recurrence rule
      if (existing.recurrenceRuleId != null) {
        await deleteRecurrenceRuleIfUnreferenced(tx, existing.recurrenceRuleId)
      }

      return reparentedChildren.map(({ id: childId }) => childId)
    })

    const affectedTaskIdsAfter = await getTaskChangeEventIds([
      ...(existing.parentId == null ? [] : [existing.parentId]),
      ...reparentedChildIds,
    ])
    setChangeEventTaskIds(c, [
      ...new Set([
        ...relatedTaskIdsBefore,
        ...checklistOwnerIds,
        ...affectedTaskIdsAfter,
      ]),
    ])

    return c.body(null, 204)
  },
)
