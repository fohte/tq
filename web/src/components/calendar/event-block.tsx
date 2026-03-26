import type { EventContentArg } from '@fullcalendar/core'
import { getEventProps } from '@web/lib/calendar-utils'
import { cn } from '@web/lib/utils'
import { Check, icons, Repeat, Sparkles } from 'lucide-react'

export function EventBlock(arg: EventContentArg) {
  const { event, timeText } = arg
  const props = getEventProps(event)
  const type = props.type ?? 'manual'
  const duration = props.duration
  const parentRef = props.parentRef
  const label = props.label
  const color = props.color
  const iconName = props.icon

  const isShort = arg.isStart && isShortEvent(event)

  // Build time detail line: "10:30 - 11:30  ·  1h  ← #488"
  const timeDetails = [
    timeText,
    duration,
    parentRef != null ? `← ${parentRef}` : undefined,
  ]
    .filter(Boolean)
    .join('  ·  ')

  if (type === 'schedule') {
    return (
      <ScheduleBlock
        event={event}
        timeDetails={timeDetails}
        isShort={isShort}
        {...(color != null ? { color } : {})}
        {...(iconName != null ? { iconName } : {})}
      />
    )
  }

  if (type === 'auto') {
    return (
      <AutoBlock
        title={event.title}
        timeDetails={timeDetails}
        isShort={isShort}
      />
    )
  }

  if (type === 'gcal') {
    return (
      <GcalBlock
        title={event.title}
        timeDetails={timeDetails}
        isShort={isShort}
      />
    )
  }

  // manual or completed
  const isCompleted = type === 'completed'

  return (
    <div
      className={cn(
        'h-full overflow-hidden rounded-md px-2.5 py-1',
        'bg-primary text-primary-foreground',
        isCompleted && 'opacity-50',
      )}
    >
      {isShort ? (
        <div className="flex items-center gap-1.5">
          {isCompleted ? (
            <Check className="size-3 shrink-0 text-[#1A1A1A]" />
          ) : (
            <div className="size-1.5 shrink-0 rounded-full bg-[#1A1A1A]" />
          )}
          <span className="truncate text-xs font-medium">{event.title}</span>
          <span className="shrink-0 font-mono text-[10px] text-white/70">
            {timeText}
          </span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            {isCompleted ? (
              <Check className="size-3.5 shrink-0 text-[#1A1A1A]" />
            ) : (
              <div className="size-2 shrink-0 rounded-full bg-[#1A1A1A]" />
            )}
            <span className="truncate text-[13px] font-medium">
              {event.title}
            </span>
          </div>
          <div className="font-mono text-[10px] text-white/70">
            {timeDetails}
          </div>
          {label != null && (
            <div className="text-[7px] font-medium text-white/70">{label}</div>
          )}
        </>
      )}
    </div>
  )
}

function isShortEvent(event: EventContentArg['event']): boolean {
  if (!event.start || !event.end) return false
  const durationMs = event.end.getTime() - event.start.getTime()
  return durationMs <= 30 * 60 * 1000 // 30 minutes or less
}

function isIconName(value: string): value is keyof typeof icons {
  return value in icons
}

function resolveIcon(name: string | undefined) {
  if (name == null || name === '') return null
  // Convert kebab-case to PascalCase: "dumbbell" -> "Dumbbell", "arrow-left" -> "ArrowLeft"
  const pascalCase = name
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
  if (!isIconName(pascalCase)) return null
  return icons[pascalCase]
}

function ScheduleBlock({
  event,
  timeDetails,
  isShort,
  color,
  iconName,
}: {
  event: EventContentArg['event']
  timeDetails: string
  isShort: boolean
  color?: { bg: string; accent: string }
  iconName?: string
}) {
  const accentColor = color?.accent ?? '#6C63FF'
  const bgColor = color?.bg ?? '#2D2B55'
  const IconComponent = resolveIcon(iconName)

  return (
    <div
      className="relative h-full overflow-hidden rounded-md py-1 pr-2 pl-2.5"
      style={{ backgroundColor: bgColor }}
    >
      {/* Left accent border */}
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: accentColor }}
      />
      {isShort ? (
        <div className="flex items-center gap-1.5 pl-1">
          {IconComponent && (
            <IconComponent
              className="size-3 shrink-0"
              style={{ color: accentColor }}
            />
          )}
          <span className="truncate text-xs font-medium text-white">
            {event.title}
          </span>
          <span
            className="shrink-0 font-mono text-[10px]"
            style={{ color: `${accentColor}99` }}
          >
            {timeDetails}
          </span>
        </div>
      ) : (
        <div className="pl-1">
          <div className="flex items-center gap-1.5">
            {IconComponent && (
              <IconComponent
                className="size-3.5 shrink-0"
                style={{ color: accentColor }}
              />
            )}
            <span className="truncate text-[13px] font-medium text-white">
              {event.title}
            </span>
          </div>
          <div
            className="font-mono text-[10px]"
            style={{ color: `${accentColor}99` }}
          >
            {timeDetails}
          </div>
        </div>
      )}
      {/* Repeat icon top-right */}
      <Repeat
        className="absolute top-1 right-1.5 size-2.5"
        style={{ color: `${accentColor}99` }}
      />
    </div>
  )
}

function AutoBlock({
  title,
  timeDetails,
  isShort,
}: {
  title: string
  timeDetails: string
  isShort: boolean
}) {
  return (
    <div className="h-full overflow-hidden rounded-md border border-primary bg-[#2D1F0F] px-2.5 py-1">
      {isShort ? (
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium text-white">
            {title}
          </span>
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-primary/20 px-1 text-[8px] font-semibold text-primary">
            <Sparkles className="size-2" />
            Auto
          </span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {timeDetails}
          </span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-white">
              {title}
            </span>
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-primary/20 px-1 py-px text-[9px] font-semibold text-primary">
              <Sparkles className="size-2.5" />
              Auto
            </span>
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">
            {timeDetails}
          </div>
        </>
      )}
    </div>
  )
}

function GcalBlock({
  title,
  timeDetails,
  isShort,
}: {
  title: string
  timeDetails: string
  isShort: boolean
}) {
  return (
    <div className="h-full overflow-hidden rounded-md bg-[#2E2E2E] px-2.5 py-1">
      {isShort ? (
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-normal text-white">
            {title}
          </span>
          <span className="shrink-0 rounded px-1 text-[8px] font-semibold text-muted-foreground">
            GCal
          </span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {timeDetails}
          </span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-normal text-white">
              {title}
            </span>
            <span className="shrink-0 rounded bg-[#2E2E2E] px-1 py-px text-[9px] font-semibold text-muted-foreground">
              GCal
            </span>
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">
            {timeDetails}
          </div>
        </>
      )}
    </div>
  )
}
