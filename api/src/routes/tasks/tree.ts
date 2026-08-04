import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { zValidator } from '@hono/zod-validator'
import { inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { taskGithubLinks, tasks } from '#db/schema'
import {
  buildTree,
  getLabelNamesByTaskId,
  resolveTaskListOrderBy,
  taskListSortBy,
} from '#routes/tasks/shared'

const subtreeIdSchema = z.array(z.object({ id: z.string() }))

const treeQuerySchema = z.object({
  rootId: z.uuid().optional(),
  sortBy: taskListSortBy.optional(),
})

export const tasksTreeApp = new Hono().get(
  '/tree',
  zValidator('query', treeQuerySchema),
  async (c) => {
    const { rootId, sortBy } = c.req.valid('query')

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
        .orderBy(...resolveTaskListOrderBy(sortBy))
    } else {
      treeTasks = await db
        .select()
        .from(tasks)
        .orderBy(...resolveTaskListOrderBy(sortBy))
    }

    const links =
      treeTasks.length > 0
        ? await db
            .select()
            .from(taskGithubLinks)
            .where(
              inArray(
                taskGithubLinks.taskId,
                treeTasks.map((t) => t.id),
              ),
            )
        : []
    const linksByTaskId = new Map(links.map((link) => [link.taskId, link]))
    const labelsByTaskId = await getLabelNamesByTaskId(
      treeTasks.map((t) => t.id),
    )

    return buildTree(treeTasks, rootId, linksByTaskId, labelsByTaskId).match(
      (tree) => c.json(tree, 200),
      (error) => {
        captureWithFingerprint(error, 'api.tasks.build-tree-failed')
        return c.json({ error: 'Internal server error' }, 500)
      },
    )
  },
)
