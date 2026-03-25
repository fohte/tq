import { app } from '@api/app'
import { db } from '@api/db/connection'
import { labels } from '@api/db/schema'

export interface TimeBlockResponse {
  id: string
  taskId: string
  startTime: string
  endTime: string | null
  isAutoScheduled: boolean
  createdAt: string
  updatedAt: string
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
    throw new Error(`Failed to create task: ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as { id: string; title: string }
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
    throw new Error(`Failed to create page: ${res.status} ${await res.text()}`)
  }
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
      `Failed to create comment: ${res.status} ${await res.text()}`,
    )
  }
  return (await res.json()) as { id: string }
}

export async function createLabel(name: string) {
  const [label] = await db.insert(labels).values({ name }).returning()
  return label!
}
