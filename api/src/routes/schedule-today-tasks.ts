import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { zValidator } from '@hono/zod-validator'
import { and, eq, gte, inArray, lte } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import { db } from '#db/connection'
import { taskQueueItems, tasks, timeBlocks } from '#db/schema'
import {
  getEvents,
  partitionAccountEvents,
} from '#integrations/google-calendar/index'
import { localDateBoundsToUtc, localNaiveDateTimeToUtc } from '#lib/timezone'
import { expandScheduleForDate } from '#routes/schedule-expansion'
import { loadSchedulesWithRules } from '#routes/schedule-shared'
import { timeBlockToResponse } from '#routes/tasks/shared'
import {
  autoAssign,
  calculateFreeSlots,
  expandedScheduleBlocksToBusyRanges,
  externalEventsToBusyRanges,
  filterSlotsByMinimumDuration,
  manualBlocksToBusyRanges,
} from '#services/auto-scheduler'
import { getSchedulingSettings } from '#services/scheduling-settings'
import { getDayQueueOrRespond } from '#services/task-queues'

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')

const todayTasksDateQuerySchema = z.object({
  date: dateSchema,
})

const todayTasksSchema = z.object({
  taskIds: z.array(z.uuid()),
  date: dateSchema,
})

const autoAssignSchema = z.object({
  date: dateSchema,
  tzOffset: z.coerce.number().int().optional(),
})

function todayTaskToResponse(row: typeof taskQueueItems.$inferSelect) {
  return {
    id: row.id,
    taskId: row.taskId,
    date: row.periodStart,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export const todayTasksApp = new Hono()
  .get(
    '/today-tasks',
    zValidator('query', todayTasksDateQuerySchema),
    async (c) => {
      const { date } = c.req.valid('query')

      const dayQueueResult = await getDayQueueOrRespond(
        c,
        'api.schedules.today-tasks-get-queue-failed',
      )
      if (dayQueueResult.isErr()) return dayQueueResult.error
      const dayQueue = dayQueueResult.value

      const rows = await db
        .select()
        .from(taskQueueItems)
        .where(
          and(
            eq(taskQueueItems.queueId, dayQueue.id),
            eq(taskQueueItems.periodStart, date),
          ),
        )
        .orderBy(taskQueueItems.sortOrder)

      return c.json(rows.map(todayTaskToResponse), 200)
    },
  )
  .put('/today-tasks', zValidator('json', todayTasksSchema), async (c) => {
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

    const dayQueueResult = await getDayQueueOrRespond(
      c,
      'api.schedules.today-tasks-put-queue-failed',
    )
    if (dayQueueResult.isErr()) return dayQueueResult.error
    const dayQueue = dayQueueResult.value

    const inserted = await db.transaction(async (tx) => {
      await tx
        .delete(taskQueueItems)
        .where(
          and(
            eq(taskQueueItems.queueId, dayQueue.id),
            eq(taskQueueItems.periodStart, date),
          ),
        )

      if (uniqueTaskIds.length === 0) {
        return []
      }

      return tx
        .insert(taskQueueItems)
        .values(
          uniqueTaskIds.map((taskId, index) => ({
            queueId: dayQueue.id,
            periodStart: date,
            taskId,
            sortOrder: index,
          })),
        )
        .returning()
    })

    return c.json(
      inserted
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(todayTaskToResponse),
      200,
    )
  })
  .post('/auto-assign', zValidator('json', autoAssignSchema), async (c) => {
    const { date, tzOffset } = c.req.valid('json')
    const offset = tzOffset ?? 0
    const { dayStart, dayEnd } = localDateBoundsToUtc(date, offset)
    const schedulingSettingsResult = await getSchedulingSettings()
    if (schedulingSettingsResult.isErr()) {
      captureWithFingerprint(
        schedulingSettingsResult.error,
        'api.schedules.auto-assign-scheduling-settings-failed',
      )
      return c.json({ error: 'Internal server error' }, 500)
    }
    const settings = schedulingSettingsResult.value
    const workStart = localNaiveDateTimeToUtc(
      `${date}T${settings.workingHoursStart}:00`,
      offset,
    )
    const workEnd = localNaiveDateTimeToUtc(
      `${date}T${settings.workingHoursEnd}:00`,
      offset,
    )

    const dayQueueResult = await getDayQueueOrRespond(
      c,
      'api.schedules.auto-assign-queue-failed',
    )
    if (dayQueueResult.isErr()) return dayQueueResult.error
    const dayQueue = dayQueueResult.value

    const queueRows = await db
      .select({ task: tasks })
      .from(taskQueueItems)
      .innerJoin(tasks, eq(taskQueueItems.taskId, tasks.id))
      .where(
        and(
          eq(taskQueueItems.queueId, dayQueue.id),
          eq(taskQueueItems.periodStart, date),
        ),
      )
      .orderBy(taskQueueItems.sortOrder)

    const schedulableTasks = queueRows
      .filter(
        (r): r is typeof r & { task: { estimatedMinutes: number } } =>
          r.task.status !== 'completed' && r.task.estimatedMinutes != null,
      )
      .map((r) => ({
        taskId: r.task.id,
        estimatedMinutes: r.task.estimatedMinutes,
      }))

    // No connected account, or every connected account merely needing
    // re-authentication (an expired/revoked refresh token), is treated the
    // same as "no calendar constraints" — auto-assign still proceeds without
    // external events. Only a genuinely unexpected error with zero successful
    // accounts is a failure worth surfacing.
    const accounts = await getEvents(
      dayStart.toISOString(),
      dayEnd.toISOString(),
    )

    const {
      events: externalEvents,
      successCount,
      authRejectedCount,
    } = partitionAccountEvents(accounts, (accountId, error) => {
      captureWithFingerprint(
        error,
        'api.schedules.auto-assign-calendar-failed',
        { extras: { accountId } },
      )
    })

    if (
      accounts.length > 0 &&
      successCount === 0 &&
      authRejectedCount < accounts.length
    ) {
      return c.json({ error: 'Internal server error' }, 500)
    }

    const scheduleRules = await loadSchedulesWithRules()
    const expandedScheduleBlocks = scheduleRules.flatMap(({ schedule, rule }) =>
      expandScheduleForDate(schedule, rule, date),
    )

    const manualBlocks = await db
      .select()
      .from(timeBlocks)
      .where(
        and(
          eq(timeBlocks.isAutoScheduled, false),
          lte(timeBlocks.startTime, dayEnd),
          gte(timeBlocks.endTime, dayStart),
        ),
      )

    const staleAutoBlocks = await db
      .select({ id: timeBlocks.id })
      .from(timeBlocks)
      .where(
        and(
          eq(timeBlocks.isAutoScheduled, true),
          gte(timeBlocks.startTime, dayStart),
          lte(timeBlocks.startTime, dayEnd),
        ),
      )

    const busyRanges = [
      ...externalEventsToBusyRanges(externalEvents),
      ...manualBlocksToBusyRanges(manualBlocks),
      ...expandedScheduleBlocksToBusyRanges(expandedScheduleBlocks, offset),
    ]

    const freeSlots = filterSlotsByMinimumDuration(
      calculateFreeSlots(workStart, workEnd, busyRanges),
      settings.minimumBlockMinutes,
    )
    const assigned = autoAssign(schedulableTasks, freeSlots)

    // Insert the newly-assigned blocks before deleting the stale ones: if the
    // insert fails, the previous auto-scheduled blocks are left in place
    // instead of ending up with none.
    const inserted =
      assigned.length > 0
        ? await db
            .insert(timeBlocks)
            .values(
              assigned.map((block) => ({
                taskId: block.taskId,
                startTime: block.startTime,
                endTime: block.endTime,
                isAutoScheduled: true,
              })),
            )
            .returning()
        : []

    if (staleAutoBlocks.length > 0) {
      // Re-check isAutoScheduled at delete time (not just at the SELECT
      // above) so a block promoted to manual between the two doesn't get
      // deleted underneath a concurrent drag/resize.
      await db.delete(timeBlocks).where(
        and(
          inArray(
            timeBlocks.id,
            staleAutoBlocks.map((b) => b.id),
          ),
          eq(timeBlocks.isAutoScheduled, true),
        ),
      )
    }

    return c.json(inserted.map(timeBlockToResponse), 200)
  })
