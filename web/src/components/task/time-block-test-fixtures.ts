import type { TimeBlock } from '#hooks/use-time-blocks'

export function makeTimeBlock(overrides: Partial<TimeBlock> = {}): TimeBlock {
  return {
    id: 'block-1',
    taskId: 'task-1',
    startTime: '2026-07-30T10:00:00.000Z',
    endTime: '2026-07-30T11:30:00.000Z',
    isAutoScheduled: false,
    createdAt: '2026-07-30T09:00:00.000Z',
    updatedAt: '2026-07-30T09:00:00.000Z',
    ...overrides,
  }
}
