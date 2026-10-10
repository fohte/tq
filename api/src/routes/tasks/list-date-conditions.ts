import {
  and,
  eq,
  exists,
  gte,
  isNotNull,
  isNull,
  lte,
  notExists,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

import { db } from '#db/connection'
import { taskQueueItems, taskQueues, tasks } from '#db/schema'
import { followUpDueTaskWaitSubquery } from '#routes/tasks/list-query-waits'
import type { ListTasksQuery } from '#schemas/task'
import { hasNoUnresolvedBlockersCondition } from '#services/task-blockers'
import { resolvePeriodStart } from '#services/task-queues'

type TaskDateFilters = Pick<
  ListTasksQuery,
  'dateFrom' | 'dateTo' | 'dueTo' | 'candidatesOn'
>

function dateIsInRange(
  column: AnyPgColumn,
  dateFrom: string | undefined,
  dateTo: string | undefined,
) {
  return and(
    isNotNull(column),
    dateFrom == null ? undefined : gte(column, dateFrom),
    dateTo == null ? undefined : lte(column, dateTo),
  )
}

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00.000Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

function taskIsNotQueuedOn(date: string) {
  const weekStart = resolvePeriodStart('week', date) ?? date
  const weekEnd = addDays(weekStart, 6)
  const periodMatch = (unit: 'day' | 'week' | 'month') =>
    and(
      eq(taskQueues.periodUnit, unit),
      eq(taskQueueItems.periodStart, resolvePeriodStart(unit, date) ?? date),
    )
  const dayQueueInCandidateWeek = and(
    eq(taskQueues.periodUnit, 'day'),
    gte(taskQueueItems.periodStart, date),
    lte(taskQueueItems.periodStart, weekEnd),
  )

  return notExists(
    db
      .select({ _: sql`1` })
      .from(taskQueueItems)
      .innerJoin(taskQueues, eq(taskQueueItems.queueId, taskQueues.id))
      .where(
        and(
          eq(taskQueueItems.taskId, tasks.id),
          or(
            dayQueueInCandidateWeek,
            periodMatch('week'),
            periodMatch('month'),
            and(
              isNull(taskQueues.periodUnit),
              isNull(taskQueueItems.periodStart),
            ),
          ),
        ),
      ),
  )
}

export function buildTaskDateConditions(query: TaskDateFilters): SQL[] {
  const conditions: SQL[] = []

  if (query.dateFrom != null || query.dateTo != null) {
    const rangeOverlap = or(
      and(
        isNotNull(tasks.startDate),
        isNotNull(tasks.dueDate),
        lte(tasks.startDate, tasks.dueDate),
        query.dateTo == null ? undefined : lte(tasks.startDate, query.dateTo),
        query.dateFrom == null ? undefined : gte(tasks.dueDate, query.dateFrom),
      ),
      dateIsInRange(tasks.startDate, query.dateFrom, query.dateTo),
      dateIsInRange(tasks.dueDate, query.dateFrom, query.dateTo),
    )
    if (rangeOverlap != null) conditions.push(rangeOverlap)
  }

  if (query.dueTo != null) {
    conditions.push(lte(tasks.dueDate, query.dueTo))
  }

  if (query.candidatesOn != null) {
    const followUpDue = exists(followUpDueTaskWaitSubquery(query.candidatesOn))
    const candidateCondition = and(
      or(
        lte(tasks.dueDate, query.candidatesOn),
        lte(tasks.startDate, query.candidatesOn),
        eq(tasks.commitment, 'active'),
        followUpDue,
      ),
      taskIsNotQueuedOn(query.candidatesOn),
      or(hasNoUnresolvedBlockersCondition(), followUpDue),
    )
    if (candidateCondition != null) conditions.push(candidateCondition)
  }

  return conditions
}
