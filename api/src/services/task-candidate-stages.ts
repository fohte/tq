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

type NonCompletedTaskCandidateStage = Exclude<TaskCandidateStage, 'completed'>

const QUEUE_CANDIDATE_STAGE_RANK = {
  'wait-resolved': -1,
  overdue: 0,
  'follow-up': 1,
  'due-today': 2,
  'due-later': 3,
  starts: 4,
  priority: 5,
} as const satisfies Record<NonCompletedTaskCandidateStage, number>

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

function candidateStageRulesByReasonPrecedence(
  date: string,
  settings: PrioritySetting[],
) {
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
      stage: 'follow-up' as const,
      condition: hasFollowUp,
      matches: (task: CandidateTask) =>
        task.waits?.some(
          (wait) => wait.resolvedAt == null && wait.followUpDate <= date,
        ) === true,
    },
    {
      stage: 'overdue' as const,
      condition: sql`${tasks.dueDate} < ${date}`,
      matches: (task: CandidateTask) =>
        task.dueDate != null && task.dueDate < date,
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
  const stages = candidateStageRulesByReasonPrecedence(date, settings)
  const completedStage =
    Math.max(...Object.values(QUEUE_CANDIDATE_STAGE_RANK)) + 1
  const cases = stages.map(
    ({ condition, stage }) =>
      sql`WHEN ${condition} THEN ${QUEUE_CANDIDATE_STAGE_RANK[stage]}::integer`,
  )
  const completedCandidate = or(...stages.map(({ condition }) => condition))
  return sql`CASE
    WHEN ${tasks.status} = 'completed' THEN
      CASE WHEN ${completedCandidate} THEN ${completedStage}::integer ELSE NULL END
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
    return candidateStageRulesByReasonPrecedence(date, settings).some(
      ({ matches }) => matches(task),
    )
      ? 'completed'
      : null
  }
  return (
    candidateStageRulesByReasonPrecedence(date, settings).find(({ matches }) =>
      matches(task),
    )?.stage ?? null
  )
}
