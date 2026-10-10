export type TaskQueueCandidateReason =
  | { kind: 'overdue'; days: number }
  | { kind: 'follow-up'; days: number }
  | { kind: 'due-today' }
  | { kind: 'due-later'; days: number }
  | { kind: 'starts'; days: number }
  | { kind: 'active' }

interface CandidateTask {
  status: string
  dueDate: string | null
  startDate: string | null
  commitment: string
  waits?: { followUpDate: string; resolvedAt: string | null }[] | undefined
}

function daysBetween(fromDate: string, toDate: string) {
  return Math.round((Date.parse(toDate) - Date.parse(fromDate)) / 86_400_000)
}

export function getTaskQueueCandidateReason(
  task: CandidateTask,
  candidateDate: string,
): TaskQueueCandidateReason | null {
  // Keep this precedence aligned with resolveTaskCandidateOrderBy so each
  // candidate's displayed reason matches the category that sorted it.
  if (task.status === 'completed') return null

  const followUpDate = task.waits
    ?.filter(
      (wait) => wait.resolvedAt == null && wait.followUpDate <= candidateDate,
    )
    .map((wait) => wait.followUpDate)
    .toSorted()[0]
  if (followUpDate != null) {
    return {
      kind: 'follow-up',
      days: daysBetween(followUpDate, candidateDate),
    }
  }

  if (task.dueDate != null && task.dueDate < candidateDate) {
    return {
      kind: 'overdue',
      days: daysBetween(task.dueDate, candidateDate),
    }
  }
  if (task.dueDate === candidateDate) return { kind: 'due-today' }

  const startableDate =
    task.startDate != null && task.startDate <= candidateDate
      ? task.startDate
      : null
  if (
    task.dueDate != null &&
    task.dueDate > candidateDate &&
    (startableDate != null || task.commitment === 'active')
  ) {
    return {
      kind: 'due-later',
      days: daysBetween(candidateDate, task.dueDate),
    }
  }
  if (startableDate != null) {
    return {
      kind: 'starts',
      days: daysBetween(startableDate, candidateDate),
    }
  }
  if (task.commitment === 'active') return { kind: 'active' }
  return null
}
