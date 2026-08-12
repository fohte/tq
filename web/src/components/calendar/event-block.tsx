import type { EventContentArg } from '@fullcalendar/core'

import { getEventProps } from '#lib/calendar-utils'
import { cn } from '#lib/utils'

type EventKind = 'manual' | 'auto' | 'gcal' | 'completed' | 'schedule'

const RULE_CLASS: Record<EventKind, string> = {
  schedule: 'border-l-primary',
  manual: 'border-l-foreground',
  completed: 'border-l-foreground',
  auto: 'border-l-muted-foreground',
  gcal: 'border-l-border',
}

const BG_CLASS: Record<EventKind, string> = {
  schedule: 'bg-card',
  gcal: 'bg-card',
  auto: 'bg-transparent',
  manual: 'bg-surface-strong',
  completed: 'bg-surface-strong',
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

  // Build time detail line: "10:30–11:30  ·  ← #488"
  const timeDetails = [
    timeText,
    parentRef != null ? `← ${parentRef}` : undefined,
  ]
    .filter(Boolean)
    .join('  ·  ')

  if (redacted) {
    return (
      <EventBlockShell
        isShort={isShort}
        className="border-dashed border-l-muted-foreground-faint bg-transparent"
        title={
          <span className="truncate font-mono text-2xs text-muted-foreground">
            予定あり
          </span>
        }
        meta={timeText}
      />
    )
  }

  const badge = type === 'auto' ? 'auto' : type === 'gcal' ? 'gcal' : undefined

  const accentColor =
    type === 'schedule'
      ? scheduleAccent
      : type === 'gcal'
        ? calendarColor
        : undefined

  return (
    <EventBlockShell
      isShort={isShort}
      className={cn(
        RULE_CLASS[type],
        BG_CLASS[type],
        type === 'auto' && 'border-dashed',
        isCompleted && 'opacity-50',
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
            'truncate text-2xs',
            type === 'gcal'
              ? 'text-muted-foreground-strong'
              : 'font-mono text-foreground',
            type === 'manual' && 'font-medium',
            isCompleted && 'line-through',
          )}
        >
          {event.title}
        </span>
      }
      badge={badge}
      meta={isShort ? timeText : timeDetails}
    />
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
  meta: string
}) {
  return (
    <div
      className={cn(
        'flex h-full min-w-0 gap-1.5 overflow-hidden border border-l-2 px-2',
        isShort ? 'flex-row items-center py-px' : 'flex-col py-1',
        className,
      )}
      style={style}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {title}
        {badge != null && (
          <span className="shrink-0 border border-border px-1 font-mono text-2xs text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
      <span
        className={cn(
          'shrink-0 truncate font-mono text-2xs whitespace-nowrap text-muted-foreground-faint',
          isShort && 'ml-auto',
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
