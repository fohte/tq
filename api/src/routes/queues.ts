import { zValidator } from '@hono/zod-validator'
import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  notInArray,
  or,
  type SQL,
} from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { taskQueueItems, taskQueues, tasks } from '#db/schema'
import { putQueueItemsSchema, queueDateSchema } from '#schemas/queue'
import {
  getQueueByKeyOrRespond,
  resolvePeriodStart,
  type TaskQueue,
} from '#services/task-queues'

const itemsQuerySchema = z.object({ date: queueDateSchema })

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
      .select({ item: taskQueueItems })
      .from(taskQueueItems)
      .innerJoin(tasks, eq(taskQueueItems.taskId, tasks.id))
      .where(
        and(
          eq(taskQueueItems.queueId, queue.id),
          periodStartCondition(periodStart),
        ),
      )
      .orderBy(asc(tasks.dueDate), taskQueueItems.sortOrder)

    return c.json(
      rows.map(({ item }) => itemToResponse(item)),
      200,
    )
  })
  .put('/:key/items', zValidator('json', putQueueItemsSchema), async (c) => {
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
    // queue's row whose period also contains this date.
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

    const updatedRows = await db.transaction(async (tx) => {
      const existingRows = await tx
        .select()
        .from(taskQueueItems)
        .where(
          and(
            eq(taskQueueItems.queueId, queue.id),
            periodStartCondition(periodStart),
          ),
        )
      const existingByTaskId = new Map(
        existingRows.map((row) => [row.taskId, row]),
      )
      const requestedTaskIds = new Set(uniqueTaskIds)

      const retainedRows = existingRows.filter((row) =>
        requestedTaskIds.has(row.taskId),
      )

      await tx
        .delete(taskQueueItems)
        .where(
          and(
            eq(taskQueueItems.queueId, queue.id),
            periodStartCondition(periodStart),
            uniqueTaskIds.length > 0
              ? notInArray(taskQueueItems.taskId, uniqueTaskIds)
              : undefined,
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

      const newTaskIds = uniqueTaskIds.filter(
        (taskId) => !existingByTaskId.has(taskId),
      )
      const maxSortOrder = Math.max(
        -1,
        ...retainedRows.map((row) => row.sortOrder),
      )
      const insertedRows =
        newTaskIds.length > 0
          ? await tx
              .insert(taskQueueItems)
              .values(
                newTaskIds.map((taskId, index) => ({
                  queueId: queue.id,
                  periodStart,
                  taskId,
                  sortOrder: maxSortOrder + index + 1,
                })),
              )
              .returning()
          : []
      const rowsByTaskId = new Map([
        ...retainedRows.map((row) => [row.taskId, row] as const),
        ...insertedRows.map((row) => [row.taskId, row] as const),
      ])

      return uniqueTaskIds.flatMap((taskId) => {
        const row = rowsByTaskId.get(taskId)
        return row == null ? [] : [row]
      })
    })

    return c.json(updatedRows.map(itemToResponse), 200)
  })
