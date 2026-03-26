import { app } from '@api/app'
import { db } from '@api/db/connection'
import { labels } from '@api/db/schema'
import { firstOrThrow } from '@api/lib/drizzle-utils'

export interface TimeBlockResponse {
  id: string
  taskId: string
  startTime: string
  endTime: string | null
  isAutoScheduled: boolean
  createdAt: string
  updatedAt: string
}

export interface RecurrenceRuleResponse {
  id: string
  type: 'daily' | 'weekly' | 'monthly' | 'custom'
  interval: number
  daysOfWeek: number[] | null
  dayOfMonth: number | null
}

export interface TaskResponse {
  id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'completed'
  context: 'work' | 'personal' | 'dev'
  startDate: string | null
  dueDate: string | null
  estimatedMinutes: number | null
  parentId: string | null
  projectId: string | null
  recurrenceRuleId: string | null
  recurrenceRule: RecurrenceRuleResponse | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  childCompletionCount?: { completed: number; total: number }
  children?: TaskResponse[]
}

export const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'

export async function createTask(
  title: string,
  opts: {
    parentId?: string
    description?: string
    dueDate?: string
    estimatedMinutes?: number
    context?: string
    labels?: string[]
  } = {},
) {
  const res = await app.request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, ...opts }),
  })
  if (res.status !== 201) {
    throw new Error(
      `Failed to create task: ${String(res.status)} ${await res.text()}`,
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test helper
  return (await res.json()) as TaskResponse
}

export async function createRecurringTask(
  title: string,
  recurrenceRule: {
    type: string
    interval: number
    daysOfWeek?: number[]
    dayOfMonth?: number
  },
  opts: {
    dueDate?: string
    description?: string
    estimatedMinutes?: number
    context?: string
  } = {},
) {
  const res = await app.request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, recurrenceRule, ...opts }),
  })
  if (res.status !== 201) {
    throw new Error(
      `Failed to create recurring task: ${String(res.status)} ${await res.text()}`,
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test helper
  return (await res.json()) as TaskResponse
}

export async function createPage(
  taskId: string,
  title: string,
  content: string,
) {
  const res = await app.request(`/api/tasks/${taskId}/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  })
  if (res.status !== 201) {
    throw new Error(
      `Failed to create page: ${String(res.status)} ${await res.text()}`,
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test helper
  return (await res.json()) as { id: string }
}

export async function createComment(taskId: string, content: string) {
  const res = await app.request(`/api/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (res.status !== 201) {
    throw new Error(
      `Failed to create comment: ${String(res.status)} ${await res.text()}`,
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test helper
  return (await res.json()) as { id: string }
}

export async function createLabel(name: string) {
  return firstOrThrow(await db.insert(labels).values({ name }).returning())
}
