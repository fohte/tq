import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { taskChecklistItems } from '#db/schema'
import {
  moveChecklistItemSchema,
  updateChecklistItemSchema,
} from '#schemas/task-checklist'
import {
  deleteChecklistItem,
  moveChecklistItem,
  setChecklistItemChecked,
  updateChecklistItem,
} from '#services/task-checklists'

function itemToResponse(item: typeof taskChecklistItems.$inferSelect) {
  return {
    id: item.id,
    checklistId: item.checklistId,
    parentItemId: item.parentItemId,
    content: item.content,
    note: item.note,
    checkedAt: item.checkedAt?.toISOString() ?? null,
    sortOrder: item.sortOrder,
    githubLinkId: item.githubLinkId,
    subtaskId: item.subtaskId,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

export const checklistItemsByIdApp = new Hono()
  .patch(
    '/:itemId',
    zValidator('json', updateChecklistItemSchema),
    async (c) => {
      const result = await db.transaction((tx) =>
        updateChecklistItem(tx, c.req.param('itemId'), c.req.valid('json')),
      )

      return result.match(
        (item) => c.json(itemToResponse(item), 200),
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
      (item) => c.json(itemToResponse(item), 200),
      (error) => c.json({ error: error.message }, error.status),
    )
  })
  .post('/:itemId/uncheck', async (c) => {
    const result = await db.transaction((tx) =>
      setChecklistItemChecked(tx, c.req.param('itemId'), false),
    )

    return result.match(
      (item) => c.json(itemToResponse(item), 200),
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
        (item) => c.json(itemToResponse(item), 200),
        (error) => c.json({ error: error.message }, error.status),
      )
    },
  )
