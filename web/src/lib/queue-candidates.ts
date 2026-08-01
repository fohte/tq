import { formatLocalDate } from '#lib/date-range'
import { type DueDateCheckable, isTaskOverdue } from '#lib/task-due-date'

interface CandidateCheckable extends DueDateCheckable {
  id: string
  startDate: string | null
}

export type CandidateReason =
  | { kind: 'overdue'; days: number }
  | { kind: 'due-today' }
  | { kind: 'starts'; days: number }

export interface QueueCandidate<T> {
  task: T
  reason: CandidateReason
}

const REASON_PRIORITY: Record<CandidateReason['kind'], number> = {
  overdue: 0,
  'due-today': 1,
  starts: 2,
}

function daysBetween(dateStr: string, todayStr: string): number {
  const date = new Date(`${dateStr}T00:00:00`)
  const today = new Date(`${todayStr}T00:00:00`)
  return Math.round((today.getTime() - date.getTime()) / 86_400_000)
}

function reasonDays(reason: CandidateReason): number {
  return reason.kind === 'due-today' ? 0 : reason.days
}

/**
 * A task is a queue candidate when it's not completed and it's overdue, due
 * today, or startable (start date today or earlier). Overdue takes
 * precedence over the other reasons since it's the most urgent one.
 */
export function getCandidateReason(
  task: CandidateCheckable,
  now: Date = new Date(),
): CandidateReason | null {
  if (task.status === 'completed') return null
  const today = formatLocalDate(now)

  if (task.dueDate != null && isTaskOverdue(task, now)) {
    return { kind: 'overdue', days: daysBetween(task.dueDate, today) }
  }
  if (task.dueDate === today) {
    return { kind: 'due-today' }
  }
  if (task.startDate != null && task.startDate <= today) {
    return { kind: 'starts', days: daysBetween(task.startDate, today) }
  }
  return null
}

/**
 * Candidate tasks for today's queue, excluding tasks already queued.
 * Sorted by reason priority (overdue, then due-today, then starts), and
 * within a reason, by how long it's been true (longest first).
 */
export function getQueueCandidates<T extends CandidateCheckable>(
  tasks: T[],
  queueTaskIds: ReadonlySet<string>,
  now: Date = new Date(),
): QueueCandidate<T>[] {
  const candidates = tasks.flatMap((task) => {
    if (queueTaskIds.has(task.id)) return []
    const reason = getCandidateReason(task, now)
    return reason == null ? [] : [{ task, reason }]
  })

  return candidates.sort((a, b) => {
    const priorityDiff =
      REASON_PRIORITY[a.reason.kind] - REASON_PRIORITY[b.reason.kind]
    return priorityDiff !== 0
      ? priorityDiff
      : reasonDays(b.reason) - reasonDays(a.reason)
  })
}

export function formatCandidateReason(reason: CandidateReason): string {
  switch (reason.kind) {
    case 'overdue':
      return `${String(reason.days)}d overdue`
    case 'due-today':
      return 'due today'
    case 'starts':
      return reason.days === 0
        ? 'starts today'
        : `started ${String(reason.days)}d ago`
  }
}
