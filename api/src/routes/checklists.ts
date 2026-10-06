import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { db } from '#db/connection'
import {
  checklistItemToResponse,
  checklistToResponse,
} from '#routes/checklist-response'
import {
  createChecklistItemSchema,
  updateChecklistSchema,
} from '#schemas/task-checklist'
import { createChecklistItem } from '#services/task-checklist-items'
import {
  deleteTaskChecklist,
  updateTaskChecklist,
} from '#services/task-checklists'

export const checklistsApp = new Hono()
  .post(
    '/:checklistId/items',
    zValidator('json', createChecklistItemSchema),
    async (c) => {
      const result = await db.transaction((tx) =>
        createChecklistItem(
          tx,
          c.req.param('checklistId'),
          c.req.valid('json'),
        ),
      )

      return result.match(
        (item) => c.json(checklistItemToResponse(item), 201),
        (error) => c.json({ error: error.message }, error.status),
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
      return c.json(checklistToResponse(updated), 200)
    },
  )
  .delete('/:checklistId', async (c) => {
    const deleted = await db.transaction((tx) =>
      deleteTaskChecklist(tx, c.req.param('checklistId')),
    )

    if (!deleted) return c.json({ error: 'Checklist not found' }, 404)
    return c.body(null, 204)
  })
