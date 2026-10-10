import type { TaskWait, TaskWaitSummary } from '#hooks/use-tasks'

const baseWait: TaskWait = {
  id: 'wait-example-001',
  taskId: 'task-example-001',
  body: 'Review the proposal',
  label: 'Review the proposal',
  followUpDate: '2099-10-13',
  resolvedAt: null,
  acknowledgedAt: null,
  createdAt: '2099-10-10T00:00:00.000Z',
}

export function makeTaskWait(overrides: Partial<TaskWait> = {}): TaskWait {
  return { ...baseWait, ...overrides }
}

export function makeTaskWaitSummary(
  overrides: Partial<TaskWaitSummary> = {},
): TaskWaitSummary {
  return {
    id: baseWait.id,
    label: baseWait.label,
    followUpDate: baseWait.followUpDate,
    resolvedAt: baseWait.resolvedAt,
    ...overrides,
  }
}
