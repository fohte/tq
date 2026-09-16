import { makeTaskDetail } from '#components/task/task-row-test-fixtures'

export const taskId = '00000000-0000-0000-0000-000000000001'

export const taskFixture = makeTaskDetail({
  id: taskId,
  number: 12,
  title: 'Write onboarding doc',
})

export const manualEvent = {
  id: 'block-manual',
  start: new Date('2026-07-29T16:00:00.000Z'),
  end: new Date('2026-07-29T16:45:00.000Z'),
  extendedProps: {
    type: 'manual' as const,
    taskId,
    isAutoScheduled: false,
  },
}

export const autoEvent = {
  id: 'block-auto',
  start: new Date('2026-07-30T10:00:00.000Z'),
  end: new Date('2026-07-30T11:30:00.000Z'),
  extendedProps: {
    type: 'auto' as const,
    taskId,
    isAutoScheduled: true,
  },
}

export const redactedEvent = {
  id: 'block-redacted',
  start: new Date('2026-07-29T16:00:00.000Z'),
  end: new Date('2026-07-29T16:45:00.000Z'),
  extendedProps: {
    type: 'manual' as const,
    taskId,
    isAutoScheduled: false,
    redacted: true,
  },
}
