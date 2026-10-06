import type { TimeBlockEvent } from '#components/calendar/calendar-view'
import type { Task } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'
import { formatShortDate, isTaskOverdue } from '#lib/task-due-date'

interface CalendarDateRange {
  startDate: string
  endDate: string
}

export function mapTaskDateCalendarEvents(
  tasks: Task[],
  visibleRange: CalendarDateRange,
  now: Date = new Date(),
): TimeBlockEvent[] {
  const today = formatLocalDate(now)
  const overdueTodayIsVisible =
    visibleRange.startDate <= today && today <= visibleRange.endDate
  const events: TimeBlockEvent[] = []

  for (const task of tasks) {
    if (task.status !== 'todo') continue
    if (task.startDate == null && task.dueDate == null) continue

    const overdue = isTaskOverdue(task, now)
    const { startDate, dueDate } = task

    if (startDate != null && dueDate != null && startDate <= dueDate) {
      if (datesOverlap(startDate, dueDate, visibleRange)) {
        events.push(
          makeTaskDateEvent(task, 'range', startDate, addOneDay(dueDate), {
            overdue,
          }),
        )
      }
    } else {
      if (dueDate != null && isDateVisible(dueDate, visibleRange)) {
        events.push(
          makeTaskDateEvent(task, 'due', dueDate, addOneDay(dueDate), {
            overdue,
          }),
        )
      }
      if (startDate != null && isDateVisible(startDate, visibleRange)) {
        events.push(
          makeTaskDateEvent(task, 'start', startDate, addOneDay(startDate)),
        )
      }
    }

    if (overdue && dueDate != null && overdueTodayIsVisible) {
      events.push(
        makeTaskDateEvent(task, 'overdue-today', today, addOneDay(today), {
          overdue: true,
          dueDateLabel: formatShortDate(dueDate, now),
          displayPriority: 1,
        }),
      )
    }
  }

  return events
}

function makeTaskDateEvent(
  task: Task,
  dateTaskKind: NonNullable<TimeBlockEvent['dateTaskKind']>,
  start: string,
  end: string,
  options: {
    overdue?: boolean
    dueDateLabel?: string
    displayPriority?: number
  } = {},
): TimeBlockEvent {
  return {
    id: `task-date-${task.id}-${dateTaskKind}`,
    title: task.title,
    start,
    end,
    type: 'task-date',
    taskId: task.id,
    allDay: true,
    dateTaskKind,
    ...(options.overdue === true ? { dateTaskOverdue: true } : {}),
    ...(options.dueDateLabel == null
      ? {}
      : { dateTaskDueDateLabel: options.dueDateLabel }),
    ...(options.displayPriority == null
      ? {}
      : { displayPriority: options.displayPriority }),
  }
}

function datesOverlap(
  startDate: string,
  endDate: string,
  visibleRange: CalendarDateRange,
): boolean {
  return startDate <= visibleRange.endDate && endDate >= visibleRange.startDate
}

function isDateVisible(date: string, visibleRange: CalendarDateRange): boolean {
  return date >= visibleRange.startDate && date <= visibleRange.endDate
}

function addOneDay(date: string): string {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
}
