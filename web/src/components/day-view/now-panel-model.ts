import type { TimeBlockEvent } from '#components/calendar/calendar-view'
import type { Task } from '#hooks/use-tasks'
import type { TimeBlock } from '#hooks/use-time-blocks'

export type NowPanelActivity =
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
    }

export interface NowPanelNextEvent {
  title: string
  minutesUntil: number
  isWarning: boolean
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
      start < dayEnd.getTime() &&
      end > dayStart.getTime()
    )
  })
  const eventById = new Map(calendarEvents.map((event) => [event.id, event]))
  const currentItems: Array<{
    activity: NowPanelActivity
    start: number
  }> = []

  for (const block of timeBlocksToday) {
    const start = parseTimestamp(block.startTime)
    const end = parseTimestamp(block.endTime)
    if (start == null || end == null || start > nowTime || end <= start)
      continue

    const event = eventById.get(block.id)
    const task = tasks.get(block.taskId)
    if (
      event == null ||
      event.type === 'completed' ||
      task?.status === 'completed'
    ) {
      continue
    }

    const isOverrun = end <= nowTime
    const statusLabel = isOverrun
      ? `block ended ${String(Math.max(1, Math.floor((nowTime - end) / MINUTE_MS)))} min ago`
      : `now (${String(minutesUntil(end, nowTime))} min left)`
    const activity: NowPanelActivity =
      event.redacted === true || task == null
        ? {
            kind: 'event',
            key: block.id,
            title: event.redacted === true ? 'Busy' : event.title,
            statusLabel,
            isOverrun,
          }
        : { kind: 'task', key: block.id, task, statusLabel, isOverrun }

    currentItems.push({ activity, start })
  }

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
    activities.push({
      kind: 'event',
      key: event.id,
      title: event.redacted === true ? 'Busy' : event.title,
      statusLabel: `now (${String(minutesUntil(end, nowTime))} min left)`,
      isOverrun: false,
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
        title: event.redacted === true ? 'Busy' : event.title,
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
      candidates.push({
        title: event.redacted === true ? 'Busy' : event.title,
        start,
        priority: 1,
        warningThresholdMinutes: event.type === 'gcal-meeting' ? 5 : null,
      })
    }
  }

  for (const block of timeBlocks) {
    const start = parseTimestamp(block.startTime)
    const end = parseTimestamp(block.endTime)
    const event = eventById.get(block.id)
    const task = tasks.get(block.taskId)
    if (
      start == null ||
      end == null ||
      start <= nowTime ||
      end <= start ||
      event == null ||
      event.type === 'completed' ||
      task?.status === 'completed'
    ) {
      continue
    }
    candidates.push({
      title: event.redacted === true ? 'Busy' : (task?.title ?? event.title),
      start,
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
