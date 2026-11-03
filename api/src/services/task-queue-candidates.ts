import type { PrioritySetting } from '#schemas/priority-settings'
import {
  type CandidateTask,
  getTaskCandidateStage,
  type TaskCandidateStage,
} from '#services/task-candidate-stages'

export type TaskQueueCandidateReason =
  | { kind: 'wait-resolved' }
  | { kind: 'overdue'; days: number }
  | { kind: 'follow-up'; days: number }
  | { kind: 'due-today' }
  | { kind: 'due-later'; days: number }
  | { kind: 'starts'; days: number }
  | { kind: 'priority'; label: string }

function daysBetween(fromDate: string, toDate: string) {
  return Math.round((Date.parse(toDate) - Date.parse(fromDate)) / 86_400_000)
}

function priorityReason(settings: PrioritySetting[], priority: number | null) {
  const label = settings.find((setting) => setting.priority === priority)?.name
  return { kind: 'priority' as const, label: label ?? 'Inbox' }
}

function reasonForStage(
  stage: TaskCandidateStage,
  task: CandidateTask,
  candidateDate: string,
  settings: PrioritySetting[],
): TaskQueueCandidateReason | null {
  switch (stage) {
    case 'completed':
      return null
    case 'wait-resolved':
      return { kind: 'wait-resolved' }
    case 'overdue':
      return {
        kind: 'overdue',
        days: daysBetween(task.dueDate ?? candidateDate, candidateDate),
      }
    case 'follow-up': {
      const followUpDate = task.waits
        ?.filter(
          (wait) =>
            wait.resolvedAt == null && wait.followUpDate <= candidateDate,
        )
        .map((wait) => wait.followUpDate)
        .toSorted()[0]
      return {
        kind: 'follow-up',
        days: daysBetween(followUpDate ?? candidateDate, candidateDate),
      }
    }
    case 'due-today':
      return { kind: 'due-today' }
    case 'due-later':
      return {
        kind: 'due-later',
        days: daysBetween(candidateDate, task.dueDate ?? candidateDate),
      }
    case 'starts':
      return {
        kind: 'starts',
        days: daysBetween(task.startDate ?? candidateDate, candidateDate),
      }
    case 'priority':
      return priorityReason(settings, task.priority)
  }
}

export function getTaskQueueCandidateReason(
  task: CandidateTask,
  candidateDate: string,
  settings: PrioritySetting[],
): TaskQueueCandidateReason | null {
  const stage = getTaskCandidateStage(task, candidateDate, settings)
  return stage == null
    ? null
    : reasonForStage(stage, task, candidateDate, settings)
}
