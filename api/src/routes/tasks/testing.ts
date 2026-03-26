import { app } from '@api/app'
import { db } from '@api/db/connection'
import { labels } from '@api/db/schema'
import { firstOrThrow } from '@api/lib/drizzle-utils'
import { jsonBody } from '@api/testing'
import { z } from 'zod'

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

const recurrenceRuleResponseSchema = z.object({
  id: z.string(),
  type: z.enum(['daily', 'weekly', 'monthly', 'custom']),
  interval: z.number(),
  daysOfWeek: z.array(z.number()).nullable(),
  dayOfMonth: z.number().nullable(),
})

const taskResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(['todo', 'in_progress', 'completed']),
  context: z.enum(['work', 'personal', 'dev']),
  startDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  estimatedMinutes: z.number().nullable(),
  parentId: z.string().nullable(),
  projectId: z.string().nullable(),
  recurrenceRuleId: z.string().nullable(),
  recurrenceRule: recurrenceRuleResponseSchema.nullable(),
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  childCompletionCount: z
    .object({ completed: z.number(), total: z.number() })
    .optional(),
  children: z.array(z.any()).optional(),
})

const idResponseSchema = z.object({ id: z.string() })

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
  return jsonBody(res, taskResponseSchema)
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
  return jsonBody(res, taskResponseSchema)
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
  return jsonBody(res, idResponseSchema)
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
  return jsonBody(res, idResponseSchema)
}

export async function createLabel(name: string) {
  return firstOrThrow(await db.insert(labels).values({ name }).returning())
}
