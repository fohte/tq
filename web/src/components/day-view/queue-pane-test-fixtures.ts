import type { QueueSectionData } from '#components/day-view/queue-pane'

export function makeQueueSectionData(
  overrides: Partial<QueueSectionData> = {},
): QueueSectionData {
  return {
    key: 'day',
    title: 'today',
    items: [],
    emptyMessage: "No tasks in today's queue",
    ...overrides,
  }
}
