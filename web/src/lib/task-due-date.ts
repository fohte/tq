import { formatLocalDate } from '#lib/date-range'

export interface DueDateCheckable {
  status: string
  dueDate: string | null
}

/** A task is overdue when it's not completed and its due date is before today. */
export function isTaskOverdue(
  task: DueDateCheckable,
  now: Date = new Date(),
): boolean {
  if (task.status === 'completed' || task.dueDate == null) return false
  return task.dueDate < formatLocalDate(now)
}

/** Format a due date as "Mon D", or "Mon D, YYYY" when it falls outside the current year. */
export function formatDueDate(dueDate: string, now: Date = new Date()): string {
  const date = new Date(`${dueDate}T00:00:00`)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}
