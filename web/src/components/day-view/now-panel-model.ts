import type { TimeBlockEvent } from '#components/calendar/calendar-view'
import type { Task } from '#hooks/use-tasks'
import type { TimeBlock } from '#hooks/use-time-blocks'

type NowPanelActivity =
  | {
      kind: 'task'
      key: string
      task: Task
      statusLabel: string
      isOverrun: boolean
    }
  | {
      kind: 'event'
      key: string
      title: string
      statusLabel: string
      isOverrun: boolean
      meetingUrl?: string
    }

interface NowPanelNextEvent {
  title: string
  minutesUntil: number
  isWarning: boolean
  meetingUrl?: string
}

export interface NowPanelModel {
  activities: NowPanelActivity[]
  emptyState: 'no-time-blocks-today' | 'no-block-now' | null
  nextEvent: NowPanelNextEvent | null
}

interface NowPanelModelInput {
  now: Date
  timeBlocks: TimeBlock[]
  calendarEvents: TimeBlockEvent[]
  tasks: Map<string, Task>
}

interface NextEventCandidate {
  title: string
  start: number
  priority: number
  warningThresholdMinutes: number | null
  meetingUrl?: string
}

interface ResolvedTimeBlock {
  block: TimeBlock
  start: number
  end: number
  event: TimeBlockEvent
  task: Task | undefined
}

const MINUTE_MS = 60_000

function parseTimestamp(value: string): number | null {
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function minutesUntil(target: number, now: number): number {
  return Math.max(1, Math.ceil((target - now) / MINUTE_MS))
}

function isGoogleCalendarEvent(event: TimeBlockEvent): boolean {
  return event.type.startsWith('gcal-')
}

function displayTitle(event: TimeBlockEvent, fallback = event.title): string {
  return event.redacted === true ? 'Busy' : fallback
}

function visibleMeetingUrl(event: TimeBlockEvent): string | undefined {
  if (event.redacted === true || !isGoogleCalendarEvent(event)) return undefined
  const meetingUrl = event.meetingUrl?.trim()
  return meetingUrl === '' ? undefined : meetingUrl
}

function resolveTimeBlocks(
  timeBlocks: TimeBlock[],
  eventById: Map<string, TimeBlockEvent>,
  tasks: Map<string, Task>,
): ResolvedTimeBlock[] {
  return timeBlocks.flatMap((block) => {
    const start = parseTimestamp(block.startTime)
    const end = parseTimestamp(block.endTime)
    const event = eventById.get(block.id)
    const task = tasks.get(block.taskId)
    if (
      start == null ||
      end == null ||
      end <= start ||
      event == null ||
      event.type === 'completed' ||
      task?.status === 'completed'
    ) {
      return []
    }
    return [{ block, start, end, event, task }]
  })
}

function isScheduleContinuation(
  candidate: TimeBlockEvent,
  candidateStart: number,
  events: TimeBlockEvent[],
  now: number,
): boolean {
  if (candidate.scheduleId == null) return false
  return events.some((event) => {
    if (
      event.type !== 'schedule' ||
      event.scheduleId !== candidate.scheduleId ||
      event.id === candidate.id
    ) {
      return false
    }
    const eventStart = parseTimestamp(event.start)
    const eventEnd = parseTimestamp(event.end)
    return (
      eventStart != null && eventEnd === candidateStart && eventStart <= now
    )
  })
}

export function buildNowPanelModel({
  now,
  timeBlocks,
  calendarEvents,
  tasks,
}: NowPanelModelInput): NowPanelModel {
  const nowTime = now.getTime()
  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)
  const timeBlocksToday = timeBlocks.filter((block) => {
    const start = parseTimestamp(block.startTime)
    const end = parseTimestamp(block.endTime)
    return (
      start != null &&
      end != null &&
      end > start &&
      start < dayEnd.getTime() &&
      end > dayStart.getTime()
    )
  })
  const eventById = new Map(calendarEvents.map((event) => [event.id, event]))
  const resolvedBlocks = resolveTimeBlocks(timeBlocks, eventById, tasks)
  const currentBlocksByTask = new Map<string, ResolvedTimeBlock>()

  for (const resolved of resolvedBlocks) {
    if (
      resolved.start >= dayEnd.getTime() ||
      resolved.end <= dayStart.getTime() ||
      resolved.start > nowTime ||
      (resolved.task == null && resolved.end <= nowTime)
    ) {
      continue
    }

    const current = currentBlocksByTask.get(resolved.block.taskId)
    if (current == null) {
      currentBlocksByTask.set(resolved.block.taskId, resolved)
      continue
    }

    const isActive = resolved.end > nowTime
    const currentIsActive = current.end > nowTime
    if (
      (isActive && !currentIsActive) ||
      (isActive === currentIsActive &&
        (isActive
          ? resolved.start < current.start
          : resolved.end > current.end))
    ) {
      currentBlocksByTask.set(resolved.block.taskId, resolved)
    }
  }

  const currentItems = [...currentBlocksByTask.values()].map((resolved) => {
    const isOverrun = resolved.end <= nowTime
    const statusLabel = isOverrun
      ? `block ended ${String(Math.max(1, Math.floor((nowTime - resolved.end) / MINUTE_MS)))} min ago`
      : `now (${String(minutesUntil(resolved.end, nowTime))} min left)`
    const activity: NowPanelActivity =
      resolved.task == null || resolved.event.redacted === true
        ? {
            kind: 'event',
            key: resolved.block.id,
            title: displayTitle(resolved.event, 'Busy'),
            statusLabel,
            isOverrun,
          }
        : {
            kind: 'task',
            key: resolved.block.id,
            task: resolved.task,
            statusLabel,
            isOverrun,
          }

    return { activity, start: resolved.start }
  })

  currentItems.sort((a, b) => a.start - b.start)

  const activities: NowPanelActivity[] = currentItems.map(
    ({ activity }) => activity,
  )
  for (const event of calendarEvents) {
    if (
      event.type !== 'gcal-meeting' ||
      event.allDay === true ||
      event.responseStatus === 'declined'
    ) {
      continue
    }
    const start = parseTimestamp(event.start)
    const end = parseTimestamp(event.end)
    if (start == null || end == null || start > nowTime || end <= nowTime)
      continue
    const meetingUrl = visibleMeetingUrl(event)
    activities.push({
      kind: 'event',
      key: event.id,
      title: displayTitle(event),
      statusLabel: `now (${String(minutesUntil(end, nowTime))} min left)`,
      isOverrun: false,
      ...(meetingUrl != null ? { meetingUrl } : {}),
    })
  }

  const candidates: NextEventCandidate[] = []
  for (const event of calendarEvents) {
    const start = parseTimestamp(event.start)
    if (start == null || start <= nowTime) continue

    if (event.type === 'schedule') {
      if (isScheduleContinuation(event, start, calendarEvents, nowTime))
        continue
      candidates.push({
        title: displayTitle(event),
        start,
        priority: 0,
        warningThresholdMinutes: 10,
      })
      continue
    }

    if (
      isGoogleCalendarEvent(event) &&
      event.allDay !== true &&
      event.responseStatus !== 'declined'
    ) {
      const meetingUrl = visibleMeetingUrl(event)
      candidates.push({
        title: displayTitle(event),
        start,
        priority: 1,
        warningThresholdMinutes: event.type === 'gcal-meeting' ? 5 : null,
        ...(meetingUrl != null ? { meetingUrl } : {}),
      })
    }
  }

  for (const resolved of resolvedBlocks) {
    if (resolved.start <= nowTime || resolved.task == null) continue
    candidates.push({
      title: displayTitle(resolved.event, resolved.task.title),
      start: resolved.start,
      priority: 2,
      warningThresholdMinutes: null,
    })
  }

  candidates.sort((a, b) => a.start - b.start || a.priority - b.priority)
  const nextCandidate = candidates[0]
  const nextEvent =
    nextCandidate == null
      ? null
      : {
          title: nextCandidate.title,
          minutesUntil: minutesUntil(nextCandidate.start, nowTime),
          isWarning:
            nextCandidate.warningThresholdMinutes != null &&
            nextCandidate.start - nowTime <=
              nextCandidate.warningThresholdMinutes * MINUTE_MS,
          ...(nextCandidate.meetingUrl != null
            ? { meetingUrl: nextCandidate.meetingUrl }
            : {}),
        }

  return {
    activities,
    emptyState:
      activities.length > 0
        ? null
        : timeBlocksToday.length === 0
          ? 'no-time-blocks-today'
          : 'no-block-now',
    nextEvent,
  }
}
