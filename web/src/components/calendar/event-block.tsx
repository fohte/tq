import type { EventContentArg } from '@fullcalendar/core'
import { Headphones, LogOut, MapPin } from 'lucide-react'

import { DotSeparatedList } from '#components/ui/dot-separated-list'
import {
  type CalendarEventProps,
  GCAL_FOCUS_TIME_EVENT_TYPE,
  GCAL_OUT_OF_OFFICE_EVENT_TYPE,
  GCAL_WORKING_LOCATION_EVENT_TYPE,
  getEventProps,
  isGcalEventType,
  isPendingGcalResponse,
} from '#lib/calendar-utils'
import { cn } from '#lib/utils'

type EventKind = NonNullable<CalendarEventProps['type']>

const RULE_CLASS: Record<EventKind, string> = {
  schedule: 'border-l-primary',
  manual: 'border-l-foreground',
  completed: 'border-l-foreground',
  auto: 'border-l-muted-foreground',
  'gcal-meeting': 'border-l-border',
  'gcal-status': 'border-l-border',
  'gcal-info': 'border-l-border',
  'gcal-solo': 'border-l-muted-foreground-ghost',
}

const BG_CLASS: Record<EventKind, string> = {
  schedule: 'bg-card',
  'gcal-meeting': 'bg-card',
  'gcal-status': 'bg-card',
  'gcal-info': 'bg-card',
  'gcal-solo': 'bg-transparent',
  auto: 'bg-transparent',
  manual: 'bg-surface-strong',
  completed: 'bg-surface-strong',
}

// Marks only the minority status/info categories, mirroring Google
// Calendar's own focus-time icon; meetings and solo events stay unmarked.
const GCAL_EVENT_TYPE_ICON: Partial<
  Record<string, React.ComponentType<{ className?: string }>>
> = {
  [GCAL_OUT_OF_OFFICE_EVENT_TYPE]: LogOut,
  [GCAL_FOCUS_TIME_EVENT_TYPE]: Headphones,
  [GCAL_WORKING_LOCATION_EVENT_TYPE]: MapPin,
}

/** Shared by EventBlock's title and GcalStatusBand, so the two can't drift on icon sizing/spacing. */
function GcalEventIconTitle({
  gcalEventType,
  title,
}: {
  gcalEventType: string | undefined
  title: string
}) {
  const Icon = GCAL_EVENT_TYPE_ICON[gcalEventType ?? '']
  return (
    <>
      {Icon != null && <Icon className="h-3 w-3 shrink-0" />}
      <span className="truncate">{title}</span>
    </>
  )
}

export function EventBlock(arg: EventContentArg) {
  const { event, timeText } = arg
  const props = getEventProps(event)
  const type = props.type ?? 'manual'
  const parentRef = props.parentRef
  const scheduleAccent = props.color?.accent
  const calendarColor = props.calendarColor
  const redacted = props.redacted ?? false

  const isShort = arg.isStart && (event.allDay || isShortEvent(event))
  const isCompleted = type === 'completed'
  const isPendingResponse = isPendingGcalResponse(props)

  const timeDetails = (
    <span className="inline-flex items-center gap-x-1">
      <DotSeparatedList
        items={[timeText, parentRef != null ? `← ${parentRef}` : undefined]}
      />
    </span>
  )

  if (redacted) {
    return (
      <EventBlockShell
        isShort={isShort}
        className="border-dashed border-l-muted-foreground-faint bg-transparent"
        title={
          <span className="min-w-0 truncate font-mono text-2xs text-muted-foreground">
            予定あり
          </span>
        }
        meta={timeText}
      />
    )
  }

  const badge = type === 'auto' ? 'auto' : undefined

  // gcal-solo drops the calendar accent along with the fill, so it reads as
  // one step weaker than a meeting rather than just another colored card.
  const accentColor =
    type === 'schedule'
      ? scheduleAccent
      : type === 'gcal-meeting' ||
          type === 'gcal-status' ||
          type === 'gcal-info'
        ? calendarColor
        : undefined

  return (
    <EventBlockShell
      isShort={isShort}
      className={cn(
        RULE_CLASS[type],
        BG_CLASS[type],
        type === 'auto' && 'border-dashed',
        (isCompleted || isPendingResponse) && 'opacity-50',
      )}
      style={
        // The left rule stays solid regardless of type; only the rest of the
        // border reads dashed for `auto` events.
        type === 'auto'
          ? { borderLeftStyle: 'solid' }
          : accentColor != null
            ? { borderLeftColor: accentColor }
            : undefined
      }
      title={
        <span
          className={cn(
            'inline-flex min-w-0 items-center gap-1 text-2xs',
            type === 'gcal-solo'
              ? 'text-muted-foreground'
              : isGcalEventType(type)
                ? 'text-muted-foreground-strong'
                : 'font-mono text-foreground',
            type === 'manual' && 'font-medium',
            isCompleted && 'line-through',
          )}
        >
          <GcalEventIconTitle
            gcalEventType={props.gcalEventType}
            title={event.title}
          />
        </span>
      }
      badge={badge}
      meta={isShort ? timeText : timeDetails}
    />
  )
}

/**
 * Rendered inside a status event's background band (`display: 'background'`
 * in calendar-grid.tsx) instead of the card-shaped EventBlock, so it reads
 * as a state of the day rather than a competing appointment. Centered by
 * the `.fc-bg-event` flex override in fullcalendar.css.
 */
export function GcalStatusBand({ event }: EventContentArg) {
  const props = getEventProps(event)

  return (
    <span className="inline-flex min-w-0 items-center gap-1 text-2xs text-muted-foreground-strong">
      <GcalEventIconTitle
        gcalEventType={props.gcalEventType}
        title={event.title}
      />
    </span>
  )
}

function EventBlockShell({
  isShort,
  className,
  style,
  title,
  badge,
  meta,
}: {
  isShort: boolean
  className?: string
  style?: React.CSSProperties | undefined
  title: React.ReactNode
  badge?: string | undefined
  meta: React.ReactNode
}) {
  return (
    <div
      className={cn(
        '@container/chip flex h-full min-w-0 gap-1.5 overflow-hidden border border-l-2 px-2',
        isShort ? 'flex-row items-center py-px' : 'flex-col py-1',
        className,
      )}
      style={style}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {title}
        {badge != null && (
          <span className="hidden shrink-0 border border-border px-1 font-mono text-2xs text-muted-foreground @min-[100px]/chip:inline">
            {badge}
          </span>
        )}
      </div>
      <span
        className={cn(
          'shrink-0 truncate font-mono text-2xs whitespace-nowrap text-muted-foreground-faint',
          isShort && 'ml-auto hidden @min-[100px]/chip:inline',
        )}
      >
        {meta}
      </span>
    </div>
  )
}

function isShortEvent(event: EventContentArg['event']): boolean {
  if (!event.start || !event.end) return false
  const durationMs = event.end.getTime() - event.start.getTime()
  return durationMs <= 30 * 60 * 1000 // 30 minutes or less
}
