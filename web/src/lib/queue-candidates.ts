import { formatLocalDate } from '#lib/date-range'
import { type DueDateCheckable, isTaskOverdue } from '#lib/task-due-date'

interface CandidateCheckable extends DueDateCheckable {
  id: string
  startDate: string | null
  commitment: string
  waits?: { followUpDate: string; resolvedAt: string | null }[] | undefined
}

export type CandidateReason =
  | { kind: 'overdue'; days: number }
  | { kind: 'follow-up'; days: number }
  | { kind: 'due-today' }
  | { kind: 'due-later'; days: number }
  | { kind: 'starts'; days: number }
  | { kind: 'active' }

export interface QueueCandidate<T> {
  task: T
  reason: CandidateReason
}

const REASON_PRIORITY: Record<CandidateReason['kind'], number> = {
  overdue: 0,
  'follow-up': 1,
  'due-today': 2,
  'due-later': 3,
  starts: 4,
  active: 5,
}

function daysBetween(fromDateStr: string, toDateStr: string): number {
  const fromDate = new Date(`${fromDateStr}T00:00:00`)
  const toDate = new Date(`${toDateStr}T00:00:00`)
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000)
}

function reasonDays(reason: CandidateReason): number {
  return reason.kind === 'overdue' ||
    reason.kind === 'follow-up' ||
    reason.kind === 'starts'
    ? reason.days
    : 0
}

/** Computes the display reason for a task already returned by `candidatesOn`. A due follow-up takes precedence over date and commitment reasons. */
function getCandidateReason(
  task: CandidateCheckable,
  now: Date = new Date(),
): CandidateReason | null {
  if (task.status === 'completed') return null
  const today = formatLocalDate(now)
  const followUpDate = task.waits
    ?.filter((wait) => wait.resolvedAt == null && wait.followUpDate <= today)
    .map((wait) => wait.followUpDate)
    .toSorted()[0]
  if (followUpDate != null) {
    return {
      kind: 'follow-up',
      days: daysBetween(followUpDate, today),
    }
  }

  if (task.dueDate != null && isTaskOverdue(task, now)) {
    return { kind: 'overdue', days: daysBetween(task.dueDate, today) }
  }
  if (task.dueDate === today) {
    return { kind: 'due-today' }
  }
  const startableDate =
    task.startDate != null && task.startDate <= today ? task.startDate : null
  if (
    task.dueDate != null &&
    task.dueDate > today &&
    (startableDate != null || task.commitment === 'active')
  ) {
    return { kind: 'due-later', days: daysBetween(today, task.dueDate) }
  }
  if (startableDate != null) {
    return { kind: 'starts', days: daysBetween(startableDate, today) }
  }
  if (task.commitment === 'active') {
    return { kind: 'active' }
  }
  return null
}

/**
 * Candidate tasks for today's queue, excluding tasks already queued.
 * Sorted by reason priority (overdue, due-today, due-later, starts, active).
 * Due-later tasks are ordered by their due date; overdue and starts tasks are
 * ordered by how long their reason has been true (longest first).
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
    if (priorityDiff !== 0) return priorityDiff
    if (a.reason.kind === 'due-later' && b.reason.kind === 'due-later') {
      return a.reason.days - b.reason.days
    }
    return reasonDays(b.reason) - reasonDays(a.reason)
  })
}

export function formatCandidateReason(reason: CandidateReason): string {
  switch (reason.kind) {
    case 'overdue':
      return `${String(reason.days)}d overdue`
    case 'follow-up':
      return reason.days === 0
        ? 'follow up today'
        : `follow up ${String(reason.days)}d ago`
    case 'due-today':
      return 'due today'
    case 'due-later':
      return `due in ${String(reason.days)}d`
    case 'starts':
      return reason.days === 0
        ? 'starts today'
        : `started ${String(reason.days)}d ago`
    case 'active':
      return 'active'
  }
}

/** dnd-kit drag data carried by a candidate card, shared by every place a candidate is draggable onto a queue. */
export interface CandidateDragData extends Record<string, unknown> {
  type: 'candidate'
  taskId: string
}

export function isCandidateDragData(
  data: Record<string, unknown> | undefined,
): data is CandidateDragData {
  return data?.['type'] === 'candidate'
}
