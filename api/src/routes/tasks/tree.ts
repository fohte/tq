import { db } from '@api/db/connection'
import { tasks, timeBlocks } from '@api/db/schema'
import { buildTree } from '@api/routes/tasks/shared'
import { zValidator } from '@hono/zod-validator'
import { and, inArray, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- raw SQL result cast
      const ids = (subtreeIds as unknown as Array<{ id: string }>).map(
        (r) => r.id,
      )
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

    const taskIds = treeTasks.map((t) => t.id)
    const activeBlocks =
      taskIds.length > 0
        ? await db
            .select({
              taskId: timeBlocks.taskId,
              startTime: timeBlocks.startTime,
            })
            .from(timeBlocks)
            .where(
              and(
                inArray(timeBlocks.taskId, taskIds),
                isNull(timeBlocks.endTime),
              ),
            )
            .orderBy(timeBlocks.startTime)
        : []

    // Use the most recent open time block per task (last in ASC order)
    const activeStartTimes = new Map<string, string>()
    for (const block of activeBlocks) {
      activeStartTimes.set(block.taskId, block.startTime.toISOString())
    }

    return c.json(buildTree(treeTasks, activeStartTimes, rootId), 200)
  },
)
