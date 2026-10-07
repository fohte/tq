import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { taskChecklists } from '#db/schema'
import { setChangeEventTaskIds } from '#lib/change-events'
import { checklistItemErrorResponse } from '#routes/checklist-item-error'
import {
  checklistItemToResponse,
  checklistToResponse,
} from '#routes/checklist-response'
import {
  createChecklistItemSchema,
  updateChecklistSchema,
} from '#schemas/task-checklist'
import { createChecklistItemWithGithubUrl } from '#services/task-checklist-github-links'
import { createChecklistItem } from '#services/task-checklist-items'
import {
  deleteTaskChecklist,
  updateTaskChecklist,
} from '#services/task-checklists'

async function getChecklistTaskId(checklistId: string): Promise<string | null> {
  const [checklist] = await db
    .select({ taskId: taskChecklists.taskId })
    .from(taskChecklists)
    .where(eq(taskChecklists.id, checklistId))

  return checklist?.taskId ?? null
}

export const checklistsApp = new Hono()
  .post(
    '/:checklistId/items',
    zValidator('json', createChecklistItemSchema),
    async (c) => {
      const checklistId = c.req.param('checklistId')
      const { github, ...input } = c.req.valid('json')
      const taskId = await getChecklistTaskId(checklistId)
      const result =
        github == null
          ? await db.transaction((tx) =>
              createChecklistItem(tx, checklistId, input),
            )
          : await createChecklistItemWithGithubUrl(
              checklistId,
              input,
              github,
              c.get('author'),
            )

      return result.match(
        (item) => {
          if (taskId != null) setChangeEventTaskIds(c, [taskId])
          return c.json(checklistItemToResponse(item), 201)
        },
        (error) =>
          checklistItemErrorResponse(c, error, 'checklist-item.create'),
      )
    },
  )
  .patch(
    '/:checklistId',
    zValidator('json', updateChecklistSchema),
    async (c) => {
      const checklistId = c.req.param('checklistId')
      const updated = await db.transaction((tx) =>
        updateTaskChecklist(tx, checklistId, c.req.valid('json')),
      )

      if (!updated) return c.json({ error: 'Checklist not found' }, 404)
      setChangeEventTaskIds(c, [updated.taskId])
      return c.json(checklistToResponse(updated), 200)
    },
  )
  .delete('/:checklistId', async (c) => {
    const deleted = await db.transaction((tx) =>
      deleteTaskChecklist(tx, c.req.param('checklistId')),
    )

    if (deleted == null) return c.json({ error: 'Checklist not found' }, 404)
    setChangeEventTaskIds(c, [deleted])
    return c.body(null, 204)
  })
