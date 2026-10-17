import type { InferResponseType } from 'hono/client'

import type { OperationClient } from '#operations/types'
import type { timeBlockToResponse } from '#routes/tasks/shared'

export type TimeBlockResponse = ReturnType<typeof timeBlockToResponse>
export type ScheduleEventResponse = InferResponseType<
  OperationClient['api']['schedule']['events']['$post'],
  201
>

export interface ScheduleOccurrence {
  scheduleId: string
  title: string
  startDate: string
  start: string
  end: string
  occurrenceStartDate: string
  occurrenceStartTime: string
  occurrenceEndTime: string
  remindBeforeMinutes: number | null
  context: string
  color: string | null
  occurrenceDate: string
  overridden: 'moved' | 'time' | null
  recurrence: ScheduleEventResponse['recurrence']
}

const defaultTimeBlock: TimeBlockResponse = {
  id: '88888888-8888-4888-8888-888888888888',
  taskId: '99999999-9999-4999-8999-999999999999',
  startTime: '2026-12-18T08:30:00.000Z',
  endTime: '2026-12-18T09:15:00.000Z',
  isAutoScheduled: false,
  createdAt: '2026-12-18T00:00:00.000Z',
  updatedAt: '2026-12-18T00:00:00.000Z',
}

export function makeTimeBlock(
  overrides: Partial<TimeBlockResponse> = {},
): TimeBlockResponse {
  return { ...defaultTimeBlock, ...overrides }
}

const defaultScheduleEvent: ScheduleEventResponse = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  title: 'Sample schedule',
  startDate: '2026-12-18',
  endDate: null,
  remindBeforeMinutes: null,
  startTime: '08:45',
  endTime: '09:15',
  recurrence: null,
  context: 'personal',
  color: null,
  constraintViolations: [],
  createdAt: '2026-12-18T08:00:00.000Z',
  updatedAt: '2026-12-18T08:00:00.000Z',
}

export function makeScheduleEvent(
  overrides: Partial<ScheduleEventResponse> = {},
): ScheduleEventResponse {
  return { ...defaultScheduleEvent, ...overrides }
}

const defaultScheduleOccurrence: ScheduleOccurrence = {
  scheduleId: 'SCHEDULE_ID',
  title: 'Sample schedule',
  startDate: '2038-02-03',
  start: '2038-02-03T08:30:00',
  end: '2038-02-03T09:30:00',
  occurrenceStartDate: '2038-02-03',
  occurrenceStartTime: '08:30',
  occurrenceEndTime: '09:30',
  remindBeforeMinutes: null,
  context: 'personal',
  color: null,
  occurrenceDate: '2038-02-03',
  overridden: null,
  recurrence: null,
}

export function makeScheduleOccurrence(
  overrides: Partial<ScheduleOccurrence> = {},
): ScheduleOccurrence {
  const occurrence = { ...defaultScheduleOccurrence, ...overrides }
  return {
    ...occurrence,
    occurrenceStartDate:
      overrides.occurrenceStartDate ??
      (occurrence.overridden === 'moved'
        ? occurrence.start.slice(0, 10)
        : occurrence.occurrenceDate),
    occurrenceStartTime:
      overrides.occurrenceStartTime ?? occurrence.start.slice(11, 16),
    occurrenceEndTime:
      overrides.occurrenceEndTime ?? occurrence.end.slice(11, 16),
  }
}
