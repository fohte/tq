import { Loader2 } from 'lucide-react'

import {
  contextLabels,
  contextValues,
} from '#components/task/create-task-modal-fields'
import { Checkbox } from '#components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'
import type { GcalCalendar } from '#hooks/use-gcal-calendars'
import { selectValueHandler } from '#lib/form-utils'
import { cn } from '#lib/utils'

export interface GcalCalendarChecklistProps {
  calendars: GcalCalendar[]
  onToggle: (calendarId: string, subscribed: boolean) => void
  onContextChange: (
    calendarId: string,
    context: 'work' | 'personal' | null,
  ) => void
  updatingCalendarId?: string | null
  updatingContextCalendarId?: string | null
}

export function GcalCalendarChecklist({
  calendars,
  onToggle,
  onContextChange,
  updatingCalendarId,
  updatingContextCalendarId,
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
              'min-w-0 flex-1 truncate text-xs',
              calendar.subscribed ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {calendar.displayName}
          </span>
          {calendar.subscribed && (
            <Select
              value={calendar.context ?? ''}
              onValueChange={selectValueHandler<(typeof contextValues)[number]>(
                (value) => {
                  onContextChange(calendar.id, value === '' ? null : value)
                },
                contextValues,
              )}
              disabled={updatingContextCalendarId === calendar.id}
            >
              <SelectTrigger size="sm" className="h-6 shrink-0 px-1.5 text-xs">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {contextValues.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === '' ? '—' : contextLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </li>
      ))}
    </ul>
  )
}
