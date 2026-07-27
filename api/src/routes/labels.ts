import { Hono } from 'hono'

import { db } from '#db/connection'
import { labels } from '#db/schema'

export const labelsApp = new Hono().get('/', async (c) => {
  const result = await db.select().from(labels).orderBy(labels.name)

  return c.json(
    result.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
      createdAt: label.createdAt.toISOString(),
    })),
    200,
  )
})
