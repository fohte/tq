import { expect } from 'vitest'
import { z } from 'zod'

import { app } from '#app'
import { db } from '#db/connection'
import { labels } from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
import { jsonBody } from '#testing'

export interface TimeBlockResponse {
  id: string
  taskId: string
  startTime: string
  endTime: string
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

export interface GithubLinkResponse {
  id: string
  owner: string
  repo: string
  number: number
  kind: 'issue' | 'pull_request'
  url: string
  state: 'open' | 'closed' | 'merged'
  title: string
  lastSyncedAt: string
}

export interface TaskResponse {
  id: string
  number: number
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
  githubLink: GithubLinkResponse | null
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

const githubLinkResponseSchema = z.object({
  id: z.string(),
  owner: z.string(),
  repo: z.string(),
  number: z.number(),
  kind: z.enum(['issue', 'pull_request']),
  url: z.string(),
  state: z.enum(['open', 'closed', 'merged']),
  title: z.string(),
  lastSyncedAt: z.string(),
})

const taskResponseSchema = z.object({
  id: z.string(),
  number: z.number(),
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
  githubLink: githubLinkResponseSchema.nullable(),
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

async function assertCreated(res: Response, label: string) {
  if (res.status !== 201) {
    expect(res.status, `${label}: ${await res.text()}`).toBe(201)
  }
}

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
  await assertCreated(res, 'Failed to create task')
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
  await assertCreated(res, 'Failed to create recurring task')
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
  await assertCreated(res, 'Failed to create page')
  return jsonBody(res, idResponseSchema)
}

export async function createComment(taskId: string, content: string) {
  const res = await app.request(`/api/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  await assertCreated(res, 'Failed to create comment')
  return jsonBody(res, idResponseSchema)
}

export async function createLabel(name: string) {
  return firstOrThrow(await db.insert(labels).values({ name }).returning())
}
