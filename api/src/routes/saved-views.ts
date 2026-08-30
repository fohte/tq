import { zValidator } from '@hono/zod-validator'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { savedViews } from '#db/schema'
import {
  createSavedViewSchema,
  listSavedViewsQuerySchema,
  updateSavedViewSchema,
} from '#schemas/saved-view'

function savedViewToResponse(savedView: typeof savedViews.$inferSelect) {
  return {
    id: savedView.id,
    name: savedView.name,
    query: savedView.query,
    position: savedView.position,
    context: savedView.context,
    createdAt: savedView.createdAt.toISOString(),
    updatedAt: savedView.updatedAt.toISOString(),
  }
}

export const savedViewsApp = new Hono()
  .post('/', zValidator('json', createSavedViewSchema), async (c) => {
    const input = c.req.valid('json')

    const [savedView] = await db
      .insert(savedViews)
      .values({
        name: input.name,
        query: input.query,
        position: input.position ?? 0,
        context: input.context ?? 'personal',
      })
      .returning()

    if (!savedView) {
      return c.json({ error: 'Failed to create saved view' }, 500)
    }

    return c.json(savedViewToResponse(savedView), 201)
  })
  .get('/', zValidator('query', listSavedViewsQuerySchema), async (c) => {
    const query = c.req.valid('query')
    const conditions = []

    if (query.context) {
      conditions.push(eq(savedViews.context, query.context))
    }

    const result = await db
      .select()
      .from(savedViews)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(savedViews.position, savedViews.createdAt)

    return c.json(result.map(savedViewToResponse), 200)
  })
  .get('/:id', async (c) => {
    const id = c.req.param('id')

    const savedView = await db.query.savedViews.findFirst({
      where: eq(savedViews.id, id),
    })
    if (!savedView) {
      return c.json({ error: 'Saved view not found' }, 404)
    }

    return c.json(savedViewToResponse(savedView), 200)
  })
  .patch('/:id', zValidator('json', updateSavedViewSchema), async (c) => {
    const id = c.req.param('id')

    const existing = await db.query.savedViews.findFirst({
      where: eq(savedViews.id, id),
    })
    if (!existing) {
      return c.json({ error: 'Saved view not found' }, 404)
    }

    const input = c.req.valid('json')

    const [updated] = await db
      .update(savedViews)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(savedViews.id, id))
      .returning()

    if (!updated) {
      return c.json({ error: 'Saved view not found' }, 404)
    }

    return c.json(savedViewToResponse(updated), 200)
  })
  .delete('/:id', async (c) => {
    const id = c.req.param('id')

    const existing = await db.query.savedViews.findFirst({
      where: eq(savedViews.id, id),
    })
    if (!existing) {
      return c.json({ error: 'Saved view not found' }, 404)
    }

    await db.delete(savedViews).where(eq(savedViews.id, id))

    return c.body(null, 204)
  })
