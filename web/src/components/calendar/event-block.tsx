import type { EventContentArg } from '@fullcalendar/core'
import type { TimeBlockEvent } from '@web/components/calendar/calendar-view'
import { cn } from '@web/lib/utils'
import { Check, Repeat, Sparkles } from 'lucide-react'

type EventType = TimeBlockEvent['type']

const containerStyles: Record<EventType, string> = {
  manual: 'bg-primary text-primary-foreground',
  auto: 'bg-primary/20 text-primary border border-dashed border-primary',
  gcal: 'bg-secondary text-secondary-foreground',
  completed: 'bg-muted text-muted-foreground opacity-70',
  schedule:
    'bg-secondary text-secondary-foreground border-l-3 border-l-primary',
}

export function EventBlock({ event, timeText }: EventContentArg) {
  const type = (event.extendedProps['type'] as EventType) ?? 'manual'

  return (
    <div
      className={cn('h-full rounded-md px-1.5 py-0.5', containerStyles[type])}
    >
      <div className="flex items-center gap-1">
        <span className="font-mono text-[0.7rem] opacity-80">{timeText}</span>
        {type === 'auto' && (
          <span className="inline-flex items-center gap-0.5 rounded bg-primary/20 px-1 text-[0.6rem] font-medium text-primary">
            <Sparkles className="size-2.5" />
            Auto
          </span>
        )}
        {type === 'gcal' && (
          <span className="rounded bg-muted px-1 text-[0.6rem] font-medium">
            GCal
          </span>
        )}
        {type === 'schedule' && <Repeat className="size-3 opacity-60" />}
        {type === 'completed' && <Check className="size-3" />}
      </div>
      <div
        className={cn(
          'truncate text-sm font-medium',
          type === 'completed' && 'line-through',
        )}
      >
        {event.title}
      </div>
    </div>
  )
}
