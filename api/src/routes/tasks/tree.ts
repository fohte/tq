import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { zValidator } from '@hono/zod-validator'
import { inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { tasks } from '#db/schema'
import { buildTree } from '#routes/tasks/shared'

const subtreeIdSchema = z.array(z.object({ id: z.string() }))

const treeQuerySchema = z.object({
  rootId: z.uuid().optional(),
})

export const tasksTreeApp = new Hono().get(
  '/tree',
  zValidator('query', treeQuerySchema),
  async (c) => {
    const { rootId } = c.req.valid('query')

    let treeTasks: Array<typeof tasks.$inferSelect>

    if (rootId != null) {
      // Use recursive CTE to fetch only IDs in the subtree
      const subtreeIds = await db.execute<{ id: string }>(sql`
        WITH RECURSIVE subtree AS (
          SELECT id FROM ${tasks} WHERE id = ${rootId}
          UNION ALL
          SELECT t.id
          FROM ${tasks} t
          INNER JOIN subtree s ON t.parent_id = s.id
        )
        SELECT id FROM subtree
      `)

      const ids = subtreeIdSchema.parse(subtreeIds).map((r) => r.id)
      if (ids.length === 0) {
        return c.json([], 200)
      }

      treeTasks = await db
        .select()
        .from(tasks)
        .where(inArray(tasks.id, ids))
        .orderBy(tasks.sortOrder, tasks.createdAt)
    } else {
      treeTasks = await db
        .select()
        .from(tasks)
        .orderBy(tasks.sortOrder, tasks.createdAt)
    }

    return buildTree(treeTasks, rootId).match(
      (tree) => c.json(tree, 200),
      (error) => {
        captureWithFingerprint(error, 'api.tasks.build-tree-failed')
        return c.json({ error: 'Internal server error' }, 500)
      },
    )
  },
)
