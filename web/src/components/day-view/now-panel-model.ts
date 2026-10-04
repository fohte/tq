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
    }

interface NowPanelNextEvent {
  title: string
  minutesUntil: number
  isWarning: boolean
}

export interface NowPanelModel {
  activities: NowPanelActivity[]
  emptyState: 'no-time-blocks-today' | 'no-block-now' | null
  nextEvent: NowPanelNextEvent | null
}

export interface NowPanelTaskRowState {
  timeRanges: string[]
  isCurrentTimeBlock: boolean
  blockEndedAt?: string
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

function getLocalDayRange(now: Date): { start: number; end: number } {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: start.getTime(), end: end.getTime() }
}

function getTimeBlocksForLocalDay(now: Date, timeBlocks: TimeBlock[]) {
  const { start: dayStart, end: dayEnd } = getLocalDayRange(now)
  return timeBlocks.filter((block) => {
    const start = parseTimestamp(block.startTime)
    const end = parseTimestamp(block.endTime)
    return (
      start != null &&
      end != null &&
      end > start &&
      start < dayEnd &&
      end > dayStart
    )
  })
}

function formatTime(value: string): string {
  const date = new Date(value)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
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
  const { start: dayStart, end: dayEnd } = getLocalDayRange(now)
  const timeBlocksToday = getTimeBlocksForLocalDay(now, timeBlocks)
  const eventById = new Map(calendarEvents.map((event) => [event.id, event]))
  const resolvedBlocks = resolveTimeBlocks(timeBlocks, eventById, tasks)
  const currentBlocksByTask = new Map<string, ResolvedTimeBlock>()

  for (const resolved of resolvedBlocks) {
    if (
      resolved.start >= dayEnd ||
      resolved.end <= dayStart ||
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
    activities.push({
      kind: 'event',
      key: event.id,
      title: displayTitle(event),
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
      candidates.push({
        title: displayTitle(event),
        start,
        priority: 1,
        warningThresholdMinutes: event.type === 'gcal-meeting' ? 5 : null,
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

export function buildNowPanelTaskRowStates({
  now,
  timeBlocks,
  model,
}: {
  now: Date
  timeBlocks: TimeBlock[]
  model: NowPanelModel
}): Map<string, NowPanelTaskRowState> {
  const timeBlocksByTaskId = new Map<string, TimeBlock[]>()
  for (const block of getTimeBlocksForLocalDay(now, timeBlocks)) {
    const blocks = timeBlocksByTaskId.get(block.taskId) ?? []
    blocks.push(block)
    timeBlocksByTaskId.set(block.taskId, blocks)
  }

  const stateByTaskId = new Map<
    string,
    Omit<NowPanelTaskRowState, 'timeRanges'>
  >()
  const timeBlockById = new Map(timeBlocks.map((block) => [block.id, block]))
  for (const activity of model.activities) {
    if (activity.kind !== 'task') continue
    const endedBlock = activity.isOverrun
      ? timeBlockById.get(activity.key)
      : undefined
    stateByTaskId.set(activity.task.id, {
      isCurrentTimeBlock: !activity.isOverrun,
      ...(endedBlock == null
        ? {}
        : { blockEndedAt: formatTime(endedBlock.endTime) }),
    })
  }

  return new Map(
    [...timeBlocksByTaskId].map(([taskId, blocks]) => {
      const state = stateByTaskId.get(taskId)
      const timeRanges = blocks
        .sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        )
        .map(
          (block) =>
            `${formatTime(block.startTime)}–${formatTime(block.endTime)}`,
        )
      return [
        taskId,
        {
          timeRanges,
          isCurrentTimeBlock: state?.isCurrentTimeBlock ?? false,
          ...(state?.blockEndedAt == null
            ? {}
            : { blockEndedAt: state.blockEndedAt }),
        },
      ]
    }),
  )
}
