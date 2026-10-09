import type { InferResponseType } from 'hono/client'

import type { api } from '#lib/api'

type TaskPreview = InferResponseType<
  typeof api.api.tasks.preview.$get,
  200
>[string]

export function makeTaskPreview(
  overrides: Partial<TaskPreview> = {},
): TaskPreview {
  return {
    id: '20000000-0000-4000-8000-000000000001',
    number: 1,
    title: 'Task title',
    status: 'todo',
    statusReason: null,
    description: null,
    ...overrides,
  }
}
