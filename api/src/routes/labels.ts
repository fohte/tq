import { zValidator } from '@hono/zod-validator'
import { and, asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { labels, taskLabels } from '#db/schema'
import { setChangeEventTaskIds } from '#lib/change-events'
import { listLabelsQuerySchema, updateLabelSchema } from '#schemas/label'

function labelToResponse(label: typeof labels.$inferSelect) {
  return {
    id: label.id,
    name: label.name,
    color: label.color,
    context: label.context,
    createdAt: label.createdAt.toISOString(),
  }
}

export const labelsApp = new Hono()
  .get('/', zValidator('query', listLabelsQuerySchema), async (c) => {
    const query = c.req.valid('query')
    const conditions = []

    if (query.context) {
      conditions.push(eq(labels.context, query.context))
    }

    const result = await db
      .select()
      .from(labels)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(labels.name)

    return c.json(result.map(labelToResponse), 200)
  })
  .patch('/:id', zValidator('json', updateLabelSchema), async (c) => {
    const id = c.req.param('id')

    const existing = await db.query.labels.findFirst({
      where: eq(labels.id, id),
    })
    if (!existing) {
      return c.json({ error: 'Label not found' }, 404)
    }

    const input = c.req.valid('json')

    if (Object.keys(input).length === 0) {
      return c.json({ error: 'At least one field must be provided' }, 400)
    }

    if (input.name !== undefined && input.name !== existing.name) {
      const conflicting = await db.query.labels.findFirst({
        where: eq(labels.name, input.name),
      })
      if (conflicting) {
        return c.json({ error: 'A label with this name already exists' }, 409)
      }
    }

    const affectedTasks =
      input.name !== undefined && input.name !== existing.name
        ? await db
            .select({ taskId: taskLabels.taskId })
            .from(taskLabels)
            .where(eq(taskLabels.labelId, id))
            .orderBy(asc(taskLabels.taskId))
        : []

    const [updated] = await db
      .update(labels)
      .set(input)
      .where(eq(labels.id, id))
      .returning()

    if (!updated) {
      return c.json({ error: 'Label not found' }, 404)
    }

    setChangeEventTaskIds(
      c,
      affectedTasks.map((task) => task.taskId),
    )

    return c.json(labelToResponse(updated), 200)
  })
  .delete('/:id', async (c) => {
    const id = c.req.param('id')

    const existing = await db.query.labels.findFirst({
      where: eq(labels.id, id),
    })
    if (!existing) {
      return c.json({ error: 'Label not found' }, 404)
    }

    const affectedTasks = await db
      .select({ taskId: taskLabels.taskId })
      .from(taskLabels)
      .where(eq(taskLabels.labelId, id))
      .orderBy(asc(taskLabels.taskId))

    await db.delete(labels).where(eq(labels.id, id))

    setChangeEventTaskIds(
      c,
      affectedTasks.map((task) => task.taskId),
    )

    return c.body(null, 204)
  })
