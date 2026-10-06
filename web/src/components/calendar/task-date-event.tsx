import { Flag, Play } from 'lucide-react'

import type {
  CalendarEventProps,
  DateTaskCalendarEventKind,
} from '#lib/calendar-utils'
import { cn } from '#lib/utils'

interface TaskDateEventProps {
  title: string
  dateTaskKind: DateTaskCalendarEventKind
  dateTaskOverdue?: boolean
  dateTaskDueDateLabel?: string
  isStart?: boolean
  isEnd?: boolean
  variant?: 'calendar' | 'month'
}

export function getTaskDateEventProps(
  props: CalendarEventProps,
): Pick<
  TaskDateEventProps,
  'dateTaskKind' | 'dateTaskOverdue' | 'dateTaskDueDateLabel'
> {
  return {
    dateTaskKind: props.dateTaskKind ?? 'range',
    ...(props.dateTaskOverdue == null
      ? {}
      : { dateTaskOverdue: props.dateTaskOverdue }),
    ...(props.dateTaskDueDateLabel == null
      ? {}
      : { dateTaskDueDateLabel: props.dateTaskDueDateLabel }),
  }
}

export function TaskDateEvent({
  title,
  dateTaskKind,
  dateTaskOverdue = false,
  dateTaskDueDateLabel,
  isStart = true,
  isEnd = true,
  variant = 'calendar',
}: TaskDateEventProps) {
  const Icon =
    dateTaskKind === 'due' || dateTaskKind === 'overdue-today'
      ? Flag
      : dateTaskKind === 'start'
        ? Play
        : undefined

  return (
    <div
      className={cn(
        'tq-task-date-event tq-all-day-content @container/task-date flex h-full min-w-0 items-center gap-1 overflow-hidden border border-transparent border-l-2 px-2 py-px font-mono text-2xs whitespace-nowrap',
        variant === 'month' && 'px-1',
        dateTaskOverdue
          ? 'bg-primary/20 border-l-primary/70 text-foreground'
          : 'bg-card border-l-muted-foreground text-muted-foreground-strong',
        !isStart && 'border-l-0',
      )}
      data-date-task-kind={dateTaskKind}
      data-date-task-overdue={dateTaskOverdue}
      data-continues-before={!isStart}
      data-continues-after={!isEnd}
    >
      {Icon != null && (
        <Icon
          className={cn(
            'h-3 w-3 shrink-0',
            dateTaskOverdue && 'text-primary/70',
          )}
        />
      )}
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {dateTaskDueDateLabel != null && (
        <span className="ml-auto hidden shrink-0 text-primary/70 @min-[100px]/task-date:inline">
          {dateTaskDueDateLabel}
        </span>
      )}
    </div>
  )
}
