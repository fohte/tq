import {
  and,
  eq,
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
import type { ListTasksQuery } from '#schemas/task'

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

function taskIsQueuedOn(date: string) {
  return notExists(
    db
      .select({ _: sql`1` })
      .from(taskQueueItems)
      .innerJoin(taskQueues, eq(taskQueueItems.queueId, taskQueues.id))
      .where(
        and(
          eq(taskQueueItems.taskId, tasks.id),
          or(
            and(
              eq(taskQueues.periodUnit, 'day'),
              eq(taskQueueItems.periodStart, date),
            ),
            and(
              eq(taskQueues.periodUnit, 'week'),
              eq(
                taskQueueItems.periodStart,
                sql`date_trunc('week', ${date}::date)::date`,
              ),
            ),
            and(
              eq(taskQueues.periodUnit, 'month'),
              eq(
                taskQueueItems.periodStart,
                sql`date_trunc('month', ${date}::date)::date`,
              ),
            ),
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
    const candidateCondition = and(
      or(
        lte(tasks.dueDate, query.candidatesOn),
        lte(tasks.startDate, query.candidatesOn),
        eq(tasks.commitment, 'active'),
      ),
      taskIsQueuedOn(query.candidatesOn),
    )
    if (candidateCondition != null) conditions.push(candidateCondition)
  }

  return conditions
}
