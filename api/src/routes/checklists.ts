import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { taskChecklists } from '#db/schema'
import { updateChecklistSchema } from '#schemas/task-checklist'
import { updateTaskChecklist } from '#services/task-checklist-ordering'

export const checklistsApp = new Hono()
  .patch(
    '/:checklistId',
    zValidator('json', updateChecklistSchema),
    async (c) => {
      const checklistId = c.req.param('checklistId')
      const updated = await db.transaction((tx) =>
        updateTaskChecklist(tx, checklistId, c.req.valid('json')),
      )

      if (!updated) return c.json({ error: 'Checklist not found' }, 404)
      return c.json(
        {
          id: updated.id,
          taskId: updated.taskId,
          name: updated.name,
          sortOrder: updated.sortOrder,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
        200,
      )
    },
  )
  .delete('/:checklistId', async (c) => {
    const [deleted] = await db
      .delete(taskChecklists)
      .where(eq(taskChecklists.id, c.req.param('checklistId')))
      .returning({ id: taskChecklists.id })

    if (!deleted) return c.json({ error: 'Checklist not found' }, 404)
    return c.body(null, 204)
  })
