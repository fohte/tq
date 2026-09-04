import { zValidator } from '@hono/zod-validator'
import { and, eq, inArray, isNull, or, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { taskQueueItems, taskQueues, tasks } from '#db/schema'
import {
  getQueueByKeyOrRespond,
  resolvePeriodStart,
  type TaskQueue,
} from '#services/task-queues'

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')

const itemsQuerySchema = z.object({ date: dateSchema })

const putItemsSchema = z.object({
  taskIds: z.array(z.uuid()),
  date: dateSchema,
})

function queueToResponse(queue: TaskQueue) {
  return {
    key: queue.key,
    name: queue.name,
    periodUnit: queue.periodUnit,
    position: queue.position,
  }
}

function itemToResponse(row: typeof taskQueueItems.$inferSelect) {
  return {
    id: row.id,
    taskId: row.taskId,
    periodStart: row.periodStart,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function periodStartCondition(periodStart: string | null): SQL {
  return periodStart == null
    ? isNull(taskQueueItems.periodStart)
    : eq(taskQueueItems.periodStart, periodStart)
}

export const queuesApp = new Hono()
  .get('/', async (c) => {
    const rows = await db.select().from(taskQueues).orderBy(taskQueues.position)

    return c.json(rows.map(queueToResponse), 200)
  })
  .get('/:key/items', zValidator('query', itemsQuerySchema), async (c) => {
    const key = c.req.param('key')
    const { date } = c.req.valid('query')

    const queueResult = await getQueueByKeyOrRespond(c, key)
    if (queueResult.isErr()) return queueResult.error
    const queue = queueResult.value

    const periodStart = resolvePeriodStart(queue.periodUnit, date)

    const rows = await db
      .select()
      .from(taskQueueItems)
      .where(
        and(
          eq(taskQueueItems.queueId, queue.id),
          periodStartCondition(periodStart),
        ),
      )
      .orderBy(taskQueueItems.sortOrder)

    return c.json(rows.map(itemToResponse), 200)
  })
  .put('/:key/items', zValidator('json', putItemsSchema), async (c) => {
    const key = c.req.param('key')
    const { taskIds, date } = c.req.valid('json')
    const uniqueTaskIds = [...new Set(taskIds)]

    if (uniqueTaskIds.length > 0) {
      const existingTasks = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(inArray(tasks.id, uniqueTaskIds))
      const existingIds = new Set(existingTasks.map((t) => t.id))
      const missing = uniqueTaskIds.filter((id) => !existingIds.has(id))
      if (missing.length > 0) {
        return c.json({ error: 'Task not found' }, 404)
      }
    }

    const queueResult = await getQueueByKeyOrRespond(c, key)
    if (queueResult.isErr()) return queueResult.error
    const queue = queueResult.value

    const periodStart = resolvePeriodStart(queue.periodUnit, date)

    // A task belongs to at most one queue at a time. That's not a DB
    // constraint (see task_queue_items.periodStart comment in core.ts), so
    // this endpoint enforces it on write: drop the task from any other
    // queue's row whose period also contains this date. Writes through
    // /api/schedule/today-tasks still bypass this check.
    // Not race-safe against a concurrent PUT for the same task on another
    // queue (no row lock); acceptable for a single-user tool, add a
    // `SELECT ... FOR UPDATE` on uniqueTaskIds if that stops being true.
    const otherQueues = (await db.select().from(taskQueues)).filter(
      (q) => q.id !== queue.id,
    )
    const overlapConditions = otherQueues.map((q) =>
      and(
        eq(taskQueueItems.queueId, q.id),
        periodStartCondition(resolvePeriodStart(q.periodUnit, date)),
      ),
    )

    const inserted = await db.transaction(async (tx) => {
      await tx
        .delete(taskQueueItems)
        .where(
          and(
            eq(taskQueueItems.queueId, queue.id),
            periodStartCondition(periodStart),
          ),
        )

      if (uniqueTaskIds.length > 0 && overlapConditions.length > 0) {
        await tx
          .delete(taskQueueItems)
          .where(
            and(
              inArray(taskQueueItems.taskId, uniqueTaskIds),
              or(...overlapConditions),
            ),
          )
      }

      if (uniqueTaskIds.length === 0) {
        return []
      }

      return tx
        .insert(taskQueueItems)
        .values(
          uniqueTaskIds.map((taskId, index) => ({
            queueId: queue.id,
            periodStart,
            taskId,
            sortOrder: index,
          })),
        )
        .returning()
    })

    return c.json(
      inserted.sort((a, b) => a.sortOrder - b.sortOrder).map(itemToResponse),
      200,
    )
  })
