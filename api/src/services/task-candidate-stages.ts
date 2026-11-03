import { asc, exists, or, type SQL, sql } from 'drizzle-orm'

import { tasks } from '#db/schema'
import {
  earliestUnresolvedTaskWaitFollowUpSubquery,
  followUpDueTaskWaitSubquery,
} from '#routes/tasks/list-query-waits'
import type { PrioritySetting } from '#schemas/priority-settings'
import {
  priorityOrderExpression,
  prioritySortOrder,
} from '#services/priority-settings'
import { hasUnacknowledgedResolvedTaskWaitCondition } from '#services/task-blockers'
import { isTaskWaitResolvedAndUnacknowledged } from '#services/task-waits'

export type TaskCandidateStage =
  | 'completed'
  | 'wait-resolved'
  | 'overdue'
  | 'follow-up'
  | 'due-today'
  | 'due-later'
  | 'starts'
  | 'priority'

export interface CandidateTask {
  status: string
  dueDate: string | null
  startDate: string | null
  priority: number | null
  waits?:
    | {
        followUpDate: string
        resolvedAt: string | null
        acknowledgedAt: string | null
      }[]
    | undefined
}

function isStartable(task: CandidateTask, date: string) {
  return task.startDate != null && task.startDate <= date
}

function priorityIsBeforeInbox(
  priority: number | null,
  settings: PrioritySetting[],
) {
  return (
    priority !== null &&
    prioritySortOrder(settings, priority) < prioritySortOrder(settings, null)
  )
}

function candidateStageRules(date: string, settings: PrioritySetting[]) {
  const hasFollowUp = exists(followUpDueTaskWaitSubquery(date))
  const priorityBeforeInbox = sql`
    ${priorityOrderExpression(settings)} < ${prioritySortOrder(settings, null)}
  `
  const dueLater = sql`
    ${tasks.dueDate} > ${date}
    AND (
      ${tasks.startDate} <= ${date}
      OR ${priorityBeforeInbox}
    )
  `
  const startable = sql`${tasks.startDate} <= ${date}`

  return [
    {
      stage: 'wait-resolved' as const,
      condition: hasUnacknowledgedResolvedTaskWaitCondition(),
      matches: (task: CandidateTask) =>
        task.waits?.some(isTaskWaitResolvedAndUnacknowledged) === true,
    },
    {
      stage: 'overdue' as const,
      condition: sql`${tasks.dueDate} < ${date}`,
      matches: (task: CandidateTask) =>
        task.dueDate != null && task.dueDate < date,
    },
    {
      stage: 'follow-up' as const,
      condition: hasFollowUp,
      matches: (task: CandidateTask) =>
        task.waits?.some(
          (wait) => wait.resolvedAt == null && wait.followUpDate <= date,
        ) === true,
    },
    {
      stage: 'due-today' as const,
      condition: sql`${tasks.dueDate} = ${date}`,
      matches: (task: CandidateTask) => task.dueDate === date,
    },
    {
      stage: 'due-later' as const,
      condition: dueLater,
      matches: (task: CandidateTask) =>
        task.dueDate != null &&
        task.dueDate > date &&
        (isStartable(task, date) ||
          priorityIsBeforeInbox(task.priority, settings)),
    },
    {
      stage: 'starts' as const,
      condition: startable,
      matches: (task: CandidateTask) => isStartable(task, date),
    },
    {
      stage: 'priority' as const,
      condition: priorityBeforeInbox,
      matches: (task: CandidateTask) =>
        priorityIsBeforeInbox(task.priority, settings),
    },
  ]
}

export function resolveTaskCandidateStageSql(
  date: string,
  settings: PrioritySetting[],
): SQL {
  const stages = candidateStageRules(date, settings)
  const completedStage = stages.length
  const cases = stages.map(
    ({ condition }, index) => sql`WHEN ${condition} THEN ${index}`,
  )
  const completedCandidate = or(...stages.map(({ condition }) => condition))
  return sql`CASE
    WHEN ${tasks.status} = 'completed' THEN
      CASE WHEN ${completedCandidate} THEN ${completedStage} ELSE NULL END
    ${sql.join(cases, sql` `)}
    ELSE NULL
  END`
}

export function resolveTaskCandidateOrderBy(
  date: string,
  settings: PrioritySetting[],
): SQL[] {
  const hasFollowUp = exists(followUpDueTaskWaitSubquery(date))
  const priorityOrder = priorityOrderExpression(settings)
  return [
    resolveTaskCandidateStageSql(date, settings),
    priorityOrder,
    sql`CASE WHEN ${tasks.dueDate} < ${date} THEN ${tasks.dueDate} END`,
    sql`CASE WHEN ${hasFollowUp} THEN (${earliestUnresolvedTaskWaitFollowUpSubquery()}) END`,
    sql`CASE WHEN ${tasks.dueDate} > ${date} THEN ${tasks.dueDate} END`,
    sql`CASE WHEN ${tasks.startDate} <= ${date} THEN ${tasks.startDate} END`,
    asc(tasks.createdAt),
    asc(tasks.number),
  ]
}

export function getTaskCandidateStage(
  task: CandidateTask,
  date: string,
  settings: PrioritySetting[],
): TaskCandidateStage | null {
  if (task.status === 'completed') {
    return candidateStageRules(date, settings).some(({ matches }) =>
      matches(task),
    )
      ? 'completed'
      : null
  }
  return (
    candidateStageRules(date, settings).find(({ matches }) => matches(task))
      ?.stage ?? null
  )
}
