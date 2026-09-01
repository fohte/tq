import { zValidator } from '@hono/zod-validator'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { labels } from '#db/schema'
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

    const [updated] = await db
      .update(labels)
      .set(input)
      .where(eq(labels.id, id))
      .returning()

    if (!updated) {
      return c.json({ error: 'Label not found' }, 404)
    }

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

    await db.delete(labels).where(eq(labels.id, id))

    return c.body(null, 204)
  })
