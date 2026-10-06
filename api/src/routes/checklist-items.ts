import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { db } from '#db/connection'
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

export const checklistItemsByIdApp = new Hono()
  .patch(
    '/:itemId',
    zValidator('json', updateChecklistItemSchema),
    async (c) => {
      const itemId = c.req.param('itemId')
      const { github, ...input } = c.req.valid('json')
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
