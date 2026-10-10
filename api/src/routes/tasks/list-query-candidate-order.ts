import { asc, exists, type SQL, sql } from 'drizzle-orm'

import { tasks } from '#db/schema'
import {
  earliestUnresolvedTaskWaitFollowUpSubquery,
  followUpDueTaskWaitSubquery,
} from '#routes/tasks/list-query-waits'

export function resolveTaskCandidateOrderBy(candidateDate: string): SQL[] {
  const hasDueFollowUp = exists(followUpDueTaskWaitSubquery(candidateDate))
  const isOverdue = sql`
    NOT (${hasDueFollowUp})
    AND ${tasks.status} <> 'completed'
    AND ${tasks.dueDate} < ${candidateDate}
  `
  const isDueLater = sql`
    NOT (${hasDueFollowUp})
    AND ${tasks.dueDate} > ${candidateDate}
    AND (
      ${tasks.startDate} <= ${candidateDate}
      OR ${tasks.commitment} = 'active'
    )
  `
  const isStarts = sql`
    NOT (${hasDueFollowUp})
    AND ${tasks.dueDate} IS NULL
    AND ${tasks.startDate} <= ${candidateDate}
  `

  return [
    sql`CASE
      WHEN ${tasks.status} = 'completed' THEN 6
      WHEN ${hasDueFollowUp} THEN 1
      WHEN ${tasks.dueDate} < ${candidateDate} THEN 0
      WHEN ${tasks.dueDate} = ${candidateDate} THEN 2
      WHEN ${isDueLater} THEN 3
      WHEN ${isStarts} THEN 4
      WHEN ${tasks.commitment} = 'active' THEN 5
      ELSE 6
    END`,
    sql`CASE WHEN ${isOverdue} THEN ${tasks.dueDate} END`,
    sql`CASE WHEN ${hasDueFollowUp} THEN (${earliestUnresolvedTaskWaitFollowUpSubquery()}) END`,
    sql`CASE WHEN ${isDueLater} THEN ${tasks.dueDate} END`,
    sql`CASE WHEN ${isStarts} THEN ${tasks.startDate} END`,
    asc(tasks.createdAt),
    asc(tasks.number),
  ]
}
