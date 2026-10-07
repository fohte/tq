import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import type { Context } from 'hono'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { taskChecklistItems, taskChecklists } from '#db/schema'
import { setChangeEventTaskIds } from '#lib/change-events'
import { checklistItemErrorResponse } from '#routes/checklist-item-error'
import { checklistItemToResponse } from '#routes/checklist-response'
import {
  moveChecklistItemSchema,
  updateChecklistItemSchema,
} from '#schemas/task-checklist'
import { updateChecklistItemWithGithubUrl } from '#services/task-checklist-github-links'
import {
  deleteChecklistItem,
  moveChecklistItem,
  setChecklistItemChecked,
  updateChecklistItem,
} from '#services/task-checklist-items'
import { promoteChecklistItemToSubtask } from '#services/task-checklist-subtasks'
import { syncTaskLinks } from '#services/task-links'

async function getTaskIdForChecklistItem(
  itemId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ taskId: taskChecklists.taskId })
    .from(taskChecklistItems)
    .innerJoin(
      taskChecklists,
      eq(taskChecklists.id, taskChecklistItems.checklistId),
    )
    .where(eq(taskChecklistItems.id, itemId))

  return row?.taskId ?? null
}

async function setChecklistItemChangeEventTaskId(
  c: Context,
  itemId: string,
): Promise<void> {
  const taskId = await getTaskIdForChecklistItem(itemId)
  if (taskId != null) setChangeEventTaskIds(c, [taskId])
}

export const checklistItemsByIdApp = new Hono()
  .patch(
    '/:itemId',
    zValidator('json', updateChecklistItemSchema),
    async (c) => {
      const itemId = c.req.param('itemId')
      const { github, ...input } = c.req.valid('json')
      await setChecklistItemChangeEventTaskId(c, itemId)
      const result =
        github == null
          ? await db.transaction((tx) => updateChecklistItem(tx, itemId, input))
          : await updateChecklistItemWithGithubUrl(
              itemId,
              input,
              github,
              c.get('author'),
            )

      return result.match(
        (item) => c.json(checklistItemToResponse(item), 200),
        (error) =>
          checklistItemErrorResponse(c, error, 'checklist-item.update'),
      )
    },
  )
  .delete('/:itemId', async (c) => {
    const itemId = c.req.param('itemId')
    await setChecklistItemChangeEventTaskId(c, itemId)
    const result = await db.transaction((tx) => deleteChecklistItem(tx, itemId))

    return result.match(
      () => c.body(null, 204),
      (error) => c.json({ error: error.message }, error.status),
    )
  })
  .post('/:itemId/check', async (c) => {
    const itemId = c.req.param('itemId')
    await setChecklistItemChangeEventTaskId(c, itemId)
    const result = await db.transaction((tx) =>
      setChecklistItemChecked(tx, itemId, true),
    )

    return result.match(
      (item) => c.json(checklistItemToResponse(item), 200),
      (error) => c.json({ error: error.message }, error.status),
    )
  })
  .post('/:itemId/uncheck', async (c) => {
    const itemId = c.req.param('itemId')
    await setChecklistItemChangeEventTaskId(c, itemId)
    const result = await db.transaction((tx) =>
      setChecklistItemChecked(tx, itemId, false),
    )

    return result.match(
      (item) => c.json(checklistItemToResponse(item), 200),
      (error) => c.json({ error: error.message }, error.status),
    )
  })
  .post('/:itemId/promote', async (c) => {
    const result = await db.transaction((tx) =>
      promoteChecklistItemToSubtask(tx, c.req.param('itemId'), c.get('author')),
    )
    if (result.isOk()) {
      const taskIds = new Set(result.value.taskIds)
      if (result.value.item.subtaskId != null) {
        const linkSync = await syncTaskLinks(result.value.item.subtaskId)
        for (const task of linkSync.outgoing) taskIds.add(task.id)
      }
      setChangeEventTaskIds(c, [...taskIds].sort())
    }

    return result.match(
      ({ item }) => c.json(checklistItemToResponse(item), 200),
      (error) => c.json({ error: error.message }, error.status),
    )
  })
  .patch(
    '/:itemId/move',
    zValidator('json', moveChecklistItemSchema),
    async (c) => {
      const itemId = c.req.param('itemId')
      await setChecklistItemChangeEventTaskId(c, itemId)
      const result = await db.transaction((tx) =>
        moveChecklistItem(tx, itemId, c.req.valid('json')),
      )

      return result.match(
        (item) => c.json(checklistItemToResponse(item), 200),
        (error) => c.json({ error: error.message }, error.status),
      )
    },
  )
