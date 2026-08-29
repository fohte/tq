import { Loader2 } from 'lucide-react'

import { Checkbox } from '#components/ui/checkbox'
import type { GcalCalendar } from '#hooks/use-gcal-calendars'
import { cn } from '#lib/utils'

export interface GcalCalendarChecklistProps {
  calendars: GcalCalendar[]
  onToggle: (calendarId: string, subscribed: boolean) => void
  updatingCalendarId?: string | null
}

export function GcalCalendarChecklist({
  calendars,
  onToggle,
  updatingCalendarId,
}: GcalCalendarChecklistProps) {
  if (calendars.length === 0) {
    return (
      <p className="py-1.5 text-xs text-muted-foreground">
        表示できるカレンダーがありません
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-0.5 border-l border-border pl-3">
      {calendars.map((calendar) => (
        <li key={calendar.id} className="flex items-center gap-2 py-1">
          {updatingCalendarId === calendar.id ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Checkbox
              checked={calendar.subscribed}
              onCheckedChange={(checked) => {
                onToggle(calendar.id, checked)
              }}
            />
          )}
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: calendar.color ?? '#71717a' }}
          />
          <span
            className={cn(
              'min-w-0 truncate text-xs',
              calendar.subscribed ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {calendar.displayName}
          </span>
        </li>
      ))}
    </ul>
  )
}
