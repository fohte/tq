import { zValidator } from '@hono/zod-validator'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { labels } from '#db/schema'
import { listLabelsQuerySchema } from '#schemas/label'

export const labelsApp = new Hono().get(
  '/',
  zValidator('query', listLabelsQuerySchema),
  async (c) => {
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

    return c.json(
      result.map((label) => ({
        id: label.id,
        name: label.name,
        color: label.color,
        context: label.context,
        createdAt: label.createdAt.toISOString(),
      })),
      200,
    )
  },
)
