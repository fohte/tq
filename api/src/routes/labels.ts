import { db } from '@api/db/connection'
import { labels } from '@api/db/schema'
import { Hono } from 'hono'

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
