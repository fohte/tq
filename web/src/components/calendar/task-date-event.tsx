import { Flag, Play } from 'lucide-react'

import type { DateTaskCalendarEventKind } from '#lib/calendar-utils'
import { cn } from '#lib/utils'

export function TaskDateEvent({
  title,
  dateTaskKind,
  dateTaskOverdue = false,
  dateTaskDueDateLabel,
  isStart = true,
  isEnd = true,
  variant = 'calendar',
}: {
  title: string
  dateTaskKind: DateTaskCalendarEventKind
  dateTaskOverdue?: boolean
  dateTaskDueDateLabel?: string
  isStart?: boolean
  isEnd?: boolean
  variant?: 'calendar' | 'month'
}) {
  const Icon =
    dateTaskKind === 'due' || dateTaskKind === 'overdue-today'
      ? Flag
      : dateTaskKind === 'start'
        ? Play
        : undefined

  return (
    <div
      className={cn(
        'tq-task-date-event @container/task-date flex h-full min-w-0 items-center gap-1 overflow-hidden border border-transparent border-l-2 px-2 py-px font-mono text-2xs whitespace-nowrap',
        variant === 'month' && 'px-1',
        dateTaskOverdue
          ? 'bg-primary/20 border-l-primary/70'
          : 'bg-surface-strong border-l-muted-foreground',
        !isStart && 'tq-all-day-continues-left border-l-0 pl-3',
        !isEnd && 'tq-all-day-continues-right pr-3',
      )}
      data-date-task-kind={dateTaskKind}
      data-date-task-overdue={dateTaskOverdue}
    >
      {Icon != null && (
        <Icon
          className={cn(
            'h-3 w-3 shrink-0',
            dateTaskOverdue && 'text-primary/70',
          )}
        />
      )}
      <span className="min-w-0 flex-1 truncate text-foreground">{title}</span>
      {dateTaskDueDateLabel != null && (
        <span className="ml-auto hidden shrink-0 text-primary/70 @min-[100px]/task-date:inline">
          {dateTaskDueDateLabel}
        </span>
      )}
    </div>
  )
}
