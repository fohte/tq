import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { checklistItemToResponse } from '#routes/checklist-response'
import {
  moveChecklistItemSchema,
  updateChecklistItemSchema,
} from '#schemas/task-checklist'
import {
  deleteChecklistItem,
  moveChecklistItem,
  setChecklistItemChecked,
  updateChecklistItem,
} from '#services/task-checklist-items'
import { promoteChecklistItemToSubtask } from '#services/task-checklist-subtasks'
import { syncTaskLinks } from '#services/task-links'

export const checklistItemsByIdApp = new Hono()
  .patch(
    '/:itemId',
    zValidator('json', updateChecklistItemSchema),
    async (c) => {
      const result = await db.transaction((tx) =>
        updateChecklistItem(tx, c.req.param('itemId'), c.req.valid('json')),
      )

      return result.match(
        (item) => c.json(checklistItemToResponse(item), 200),
        (error) => c.json({ error: error.message }, error.status),
      )
    },
  )
  .delete('/:itemId', async (c) => {
    const result = await db.transaction((tx) =>
      deleteChecklistItem(tx, c.req.param('itemId')),
    )

    return result.match(
      () => c.body(null, 204),
      (error) => c.json({ error: error.message }, error.status),
    )
  })
  .post('/:itemId/check', async (c) => {
    const result = await db.transaction((tx) =>
      setChecklistItemChecked(tx, c.req.param('itemId'), true),
    )

    return result.match(
      (item) => c.json(checklistItemToResponse(item), 200),
      (error) => c.json({ error: error.message }, error.status),
    )
  })
  .post('/:itemId/uncheck', async (c) => {
    const result = await db.transaction((tx) =>
      setChecklistItemChecked(tx, c.req.param('itemId'), false),
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
    if (result.isOk() && result.value.subtaskId != null) {
      await syncTaskLinks(result.value.subtaskId)
    }

    return result.match(
      (item) => c.json(checklistItemToResponse(item), 200),
      (error) => c.json({ error: error.message }, error.status),
    )
  })
  .patch(
    '/:itemId/move',
    zValidator('json', moveChecklistItemSchema),
    async (c) => {
      const result = await db.transaction((tx) =>
        moveChecklistItem(tx, c.req.param('itemId'), c.req.valid('json')),
      )

      return result.match(
        (item) => c.json(checklistItemToResponse(item), 200),
        (error) => c.json({ error: error.message }, error.status),
      )
    },
  )
