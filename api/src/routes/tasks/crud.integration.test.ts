import { app } from '@api/app'
import {
  createTask,
  TaskResponse,
  TEST_UUID,
  TimeBlockResponse,
} from '@api/routes/tasks/testing'
import { setupTestDb } from '@api/testing'
import { describe, expect, it } from 'vitest'

setupTestDb()

describe('tasks CRUD API', () => {
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

    it('filters by parentId', async () => {
      const parent = await createTask('Parent')
      await createTask('Child 1', { parentId: parent.id })
      await createTask('Child 2', { parentId: parent.id })
      await createTask('Orphan')

      const res = await app.request(`/api/tasks?parentId=${parent.id}`)

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(2)
      expect(body.every((t) => t.parentId === parent.id)).toBe(true)
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

    it('includes timeBlocks in response', async () => {
      const task = await createTask('With blocks')
      await app.request(`/api/tasks/${task.id}/start`, { method: 'POST' })
      await app.request(`/api/tasks/${task.id}/stop`, { method: 'POST' })
      await app.request(`/api/tasks/${task.id}/start`, { method: 'POST' })

      const res = await app.request(`/api/tasks/${task.id}`)

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse & {
        timeBlocks: TimeBlockResponse[]
      }
      expect(body.timeBlocks).toHaveLength(2)
      // First block is closed, second is open
      expect(body.timeBlocks[0]!.endTime).not.toBeNull()
      expect(body.timeBlocks[1]!.endTime).toBeNull()
    })

    it('returns empty timeBlocks when task has none', async () => {
      const task = await createTask('No blocks')

      const res = await app.request(`/api/tasks/${task.id}`)

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse & {
        timeBlocks: TimeBlockResponse[]
      }
      expect(body.timeBlocks).toEqual([])
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
})
