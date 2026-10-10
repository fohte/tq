import type { timeBlockToResponse } from '#routes/tasks/shared'

export type TimeBlockResponse = ReturnType<typeof timeBlockToResponse>

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

type ScheduleEventResponse = {
  id: string
  title: string
  startTime: string
  endTime: string
  recurrence: {
    id: string
    type: 'daily' | 'weekly' | 'monthly' | 'custom'
    interval: number
    daysOfWeek: number[] | null
    dayOfMonth: number | null
  } | null
  context: 'work' | 'personal' | null
  color: string | null
  createdAt: string
  updatedAt: string
}

const defaultScheduleEvent: ScheduleEventResponse = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  title: 'Sample schedule',
  startTime: '08:45',
  endTime: '09:15',
  recurrence: null,
  context: 'personal',
  color: null,
  createdAt: '2026-12-18T08:00:00.000Z',
  updatedAt: '2026-12-18T08:00:00.000Z',
}

export function makeScheduleEvent(
  overrides: Partial<ScheduleEventResponse> = {},
): ScheduleEventResponse {
  return { ...defaultScheduleEvent, ...overrides }
}
