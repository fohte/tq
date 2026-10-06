import type { EventContentArg } from '@fullcalendar/core'
import { Headphones, LogOut, MapPin } from 'lucide-react'

import {
  getTaskDateEventProps,
  TaskDateEvent,
} from '#components/calendar/task-date-event'
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

interface EventBlockStyle extends React.CSSProperties {
  '--event-accent'?: string
}

const RULE_CLASS: Record<EventKind, string> = {
  schedule: 'border-l-primary',
  manual: 'border-l-muted-foreground',
  completed: 'border-l-foreground',
  auto: 'border-l-muted-foreground',
  'gcal-meeting': 'border-l-border',
  'gcal-status': 'border-l-border',
  'gcal-info': 'border-l-border',
  'gcal-solo': 'border-l-muted-foreground-ghost',
  'task-date': 'border-l-muted-foreground',
}

const BG_CLASS: Record<EventKind, string> = {
  schedule: 'bg-card',
  'gcal-meeting': 'bg-card',
  'gcal-status': 'bg-card',
  'gcal-info': 'bg-card',
  'gcal-solo': 'bg-transparent',
  auto: 'bg-transparent',
  manual: 'bg-card',
  completed: 'bg-surface-strong',
  'task-date': 'bg-card',
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
  const { event, timeText, isMirror } = arg
  const props = getEventProps(event)
  const type = props.type ?? 'manual'
  const parentRef = props.parentRef
  const scheduleAccent = props.color?.accent
  const calendarColor = props.calendarColor
  const redacted = props.redacted ?? false

  if (type === 'task-date') {
    return (
      <TaskDateEvent
        title={event.title}
        {...getTaskDateEventProps(props)}
        isStart={arg.isStart}
        isEnd={arg.isEnd}
      />
    )
  }

  const isShort = event.allDay || (arg.isStart && isShortEvent(event))
  const isCompleted = type === 'completed'
  const isPendingResponse = isPendingGcalResponse(props)
  const continuesBefore = event.allDay && !arg.isStart
  const continuesAfter = event.allDay && !arg.isEnd

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
        className={cn(
          'border-dashed border-l-muted-foreground-faint bg-transparent',
          event.allDay && 'tq-all-day-content',
          continuesBefore && 'border-l-0',
        )}
        continuesBefore={continuesBefore}
        continuesAfter={continuesAfter}
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

  const accentColor =
    type === 'schedule'
      ? scheduleAccent
      : type === 'gcal-meeting' ||
          type === 'gcal-info' ||
          type === 'gcal-solo' ||
          type === 'gcal-status'
        ? calendarColor
        : undefined
  const fillPercent = type === 'gcal-solo' ? 14 : 32
  const isColoredAppointment =
    type === 'schedule' ||
    type === 'gcal-meeting' ||
    type === 'gcal-info' ||
    type === 'gcal-solo'

  return (
    <EventBlockShell
      isShort={isShort}
      className={cn(
        RULE_CLASS[type],
        BG_CLASS[type],
        isColoredAppointment && type !== 'gcal-solo' && 'border-l-4',
        type === 'gcal-solo' && 'border-l-2',
        type === 'auto' && 'border-dashed',
        type === 'auto' && 'border-l-solid!',
        type !== 'auto' && accentColor != null && 'border-l-(--event-accent)',
        (isCompleted || isPendingResponse) && 'opacity-50',
        event.allDay && 'tq-all-day-content',
        continuesBefore && 'border-l-0',
      )}
      continuesBefore={continuesBefore}
      continuesAfter={continuesAfter}
      style={
        accentColor == null
          ? undefined
          : {
              '--event-accent': accentColor,
              ...(isColoredAppointment
                ? {
                    backgroundColor: `color-mix(in srgb, var(--event-accent) ${String(fillPercent)}%, var(--card))`,
                  }
                : {}),
            }
      }
      title={
        <span
          className={cn(
            'inline-flex min-w-0 items-center gap-1 text-2xs',
            isColoredAppointment
              ? 'font-sans font-semibold text-foreground'
              : type === 'manual' || type === 'auto'
                ? 'font-mono text-muted-foreground-strong'
                : isGcalEventType(type)
                  ? 'text-muted-foreground-strong'
                  : 'font-mono text-foreground',
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
      isMirror={isMirror}
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
  continuesBefore = false,
  continuesAfter = false,
  style,
  title,
  badge,
  meta,
  isMirror = false,
}: {
  isShort: boolean
  className?: string
  continuesBefore?: boolean
  continuesAfter?: boolean
  style?: EventBlockStyle | undefined
  title: React.ReactNode
  badge?: string | undefined
  meta: React.ReactNode
  isMirror?: boolean
}) {
  return (
    <div
      className={cn(
        '@container/chip flex h-full min-w-0 gap-1.5 overflow-hidden border border-l-2 px-2',
        isShort ? 'flex-row items-center py-px' : 'flex-col py-1',
        className,
      )}
      style={style}
      data-continues-before={continuesBefore}
      data-continues-after={continuesAfter}
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
        data-testid="event-time"
        className={cn(
          'shrink-0 truncate font-mono text-2xs whitespace-nowrap text-muted-foreground-faint',
          isShort && 'ml-auto',
          // The mirror is the only feedback for where a drag will land, so
          // it must keep showing the time even on a chip too narrow to fit
          // it normally.
          isShort && !isMirror && 'hidden @min-[100px]/chip:inline',
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
