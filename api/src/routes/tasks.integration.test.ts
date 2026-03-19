import { app } from '@api/app'
import { setupTestDb } from '@api/testing'
import { describe, expect, it } from 'vitest'

setupTestDb()

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'

interface TaskResponse {
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

describe('tasks API', () => {
  describe('POST /api/tasks', () => {
    it('creates a task with only title', async () => {
      const res = await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Buy groceries' }),
      })

      expect(res.status).toBe(201)
      const body = (await res.json()) as TaskResponse
      expect(body.title).toBe('Buy groceries')
      expect(body.status).toBe('todo')
      expect(body.context).toBe('personal')
      expect(body.id).toBeDefined()
    })

    it('creates a task with all optional fields', async () => {
      const res = await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Deploy app',
          description: 'Deploy to production',
          startDate: '2026-03-20',
          dueDate: '2026-03-25',
          estimatedMinutes: 120,
          context: 'work',
        }),
      })

      expect(res.status).toBe(201)
      const body = (await res.json()) as TaskResponse
      expect(body.title).toBe('Deploy app')
      expect(body.description).toBe('Deploy to production')
      expect(body.startDate).toBe('2026-03-20')
      expect(body.dueDate).toBe('2026-03-25')
      expect(body.estimatedMinutes).toBe(120)
      expect(body.context).toBe('work')
    })

    it('returns 400 for empty title', async () => {
      const res = await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '' }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 404 for non-existent parentId', async () => {
      const res = await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Child task',
          parentId: TEST_UUID,
        }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/tasks', () => {
    it('returns empty list when no tasks exist', async () => {
      const res = await app.request('/api/tasks')

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    })

    it('returns all tasks', async () => {
      await createTask('Task A')
      await createTask('Task B')

      const res = await app.request('/api/tasks')

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(2)
    })

    it('filters by status', async () => {
      const taskA = await createTask('Task A')
      await createTask('Task B')

      await app.request(`/api/tasks/${taskA.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })

      const res = await app.request('/api/tasks?status=todo')

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(1)
      expect(body[0]!.title).toBe('Task B')
    })
  })

  describe('GET /api/tasks/:id', () => {
    it('returns a task by ID', async () => {
      const created = await createTask('My task')

      const res = await app.request(`/api/tasks/${created.id}`)

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse
      expect(body.title).toBe('My task')
      expect(body.childCompletionCount).toEqual({ completed: 0, total: 0 })
    })

    it('returns 404 for non-existent ID', async () => {
      const res = await app.request(`/api/tasks/${TEST_UUID}`)

      expect(res.status).toBe(404)
    })

    it('includes child completion count', async () => {
      const parent = await createTask('Parent')
      await createTask('Child 1', { parentId: parent.id })
      const child2 = await createTask('Child 2', { parentId: parent.id })

      await app.request(`/api/tasks/${child2.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })

      const res = await app.request(`/api/tasks/${parent.id}`)

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse
      expect(body.childCompletionCount).toEqual({ completed: 1, total: 2 })
    })
  })

  describe('PATCH /api/tasks/:id', () => {
    it('updates task fields', async () => {
      const created = await createTask('Original')

      const res = await app.request(`/api/tasks/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated', description: 'New desc' }),
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse
      expect(body.title).toBe('Updated')
      expect(body.description).toBe('New desc')
    })

    it('returns 404 for non-existent task', async () => {
      const res = await app.request(`/api/tasks/${TEST_UUID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated' }),
      })

      expect(res.status).toBe(404)
    })

    it('ignores parentId in general update', async () => {
      const parent = await createTask('Parent')
      const child = await createTask('Child')

      const res = await app.request(`/api/tasks/${child.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated', parentId: parent.id }),
      })

      // parentId is stripped by Zod and not applied
      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse
      expect(body.title).toBe('Updated')
      expect(body.parentId).toBeNull()
    })

    it('sets nullable fields to null', async () => {
      const created = await createTask('Task', {
        description: 'Some desc',
      })

      const res = await app.request(`/api/tasks/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: null }),
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse
      expect(body.description).toBeNull()
    })
  })

  describe('PATCH /api/tasks/:id/status', () => {
    it('updates task status', async () => {
      const created = await createTask('Task')

      const res = await app.request(`/api/tasks/${created.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse
      expect(body.status).toBe('in_progress')
    })

    it('returns 404 for non-existent task', async () => {
      const res = await app.request(`/api/tasks/${TEST_UUID}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })

      expect(res.status).toBe(404)
    })

    it('returns 400 for invalid status', async () => {
      const created = await createTask('Task')

      const res = await app.request(`/api/tasks/${created.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'invalid' }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('PATCH /api/tasks/:id/parent', () => {
    it('sets parent task', async () => {
      const parent = await createTask('Parent')
      const child = await createTask('Child')

      const res = await app.request(`/api/tasks/${child.id}/parent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: parent.id }),
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse
      expect(body.parentId).toBe(parent.id)
    })

    it('removes parent by setting null', async () => {
      const parent = await createTask('Parent')
      const child = await createTask('Child', { parentId: parent.id })

      const res = await app.request(`/api/tasks/${child.id}/parent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: null }),
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse
      expect(body.parentId).toBeNull()
    })

    it('returns 409 for self-referencing parent', async () => {
      const task = await createTask('Task')

      const res = await app.request(`/api/tasks/${task.id}/parent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: task.id }),
      })

      expect(res.status).toBe(409)
    })

    it('returns 409 for circular reference', async () => {
      const grandparent = await createTask('Grandparent')
      const parent = await createTask('Parent', {
        parentId: grandparent.id,
      })
      const child = await createTask('Child', { parentId: parent.id })

      const res = await app.request(`/api/tasks/${grandparent.id}/parent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: child.id }),
      })

      expect(res.status).toBe(409)
    })

    it('returns 404 for non-existent parent', async () => {
      const task = await createTask('Task')

      const res = await app.request(`/api/tasks/${task.id}/parent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: TEST_UUID }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/tasks/:id', () => {
    it('deletes a task', async () => {
      const created = await createTask('Task')

      const res = await app.request(`/api/tasks/${created.id}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)

      const getRes = await app.request(`/api/tasks/${created.id}`)
      expect(getRes.status).toBe(404)
    })

    it('returns 404 for non-existent task', async () => {
      const res = await app.request(`/api/tasks/${TEST_UUID}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(404)
    })

    it('sets children parentId to null on delete', async () => {
      const parent = await createTask('Parent')
      const child = await createTask('Child', { parentId: parent.id })

      await app.request(`/api/tasks/${parent.id}`, {
        method: 'DELETE',
      })

      const res = await app.request(`/api/tasks/${child.id}`)
      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse
      expect(body.parentId).toBeNull()
    })
  })

  describe('GET /api/tasks/tree', () => {
    it('returns empty array when no tasks', async () => {
      const res = await app.request('/api/tasks/tree')

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    })

    it('returns tree structure with children', async () => {
      const parent = await createTask('Parent')
      await createTask('Child 1', { parentId: parent.id })
      await createTask('Child 2', { parentId: parent.id })

      const res = await app.request('/api/tasks/tree')

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(1)
      expect(body[0]!.title).toBe('Parent')
      expect(body[0]!.children).toHaveLength(2)
      expect(body[0]!.childCompletionCount!.total).toBe(2)
    })
  })

  describe('GET /api/tasks/search', () => {
    it('filters tasks without estimates when hasEstimate=false', async () => {
      await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'With estimate',
          estimatedMinutes: 60,
        }),
      })
      await createTask('Without estimate')

      const res = await app.request('/api/tasks/search?hasEstimate=false')

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(1)
      expect(body[0]!.title).toBe('Without estimate')
    })
  })

  describe('GET /api/tasks/search/suggest', () => {
    it('returns suggestions for prefix', async () => {
      const res = await app.request('/api/tasks/search/suggest?prefix=is:')

      expect(res.status).toBe(200)
      const body = (await res.json()) as Array<{
        value: string
        display: string
        category: string
      }>
      expect(body.length).toBeGreaterThan(0)
      expect(body.every((s) => s.category === 'is')).toBe(true)
    })
  })
})

async function createTask(
  title: string,
  opts: { parentId?: string; description?: string } = {},
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
