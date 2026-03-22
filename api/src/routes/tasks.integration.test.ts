import { app } from '@api/app'
import { setupTestDb } from '@api/testing'
import { describe, expect, it } from 'vitest'

setupTestDb()

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'

interface TimeBlockResponse {
  id: string
  taskId: string
  startTime: string
  endTime: string | null
  isAutoScheduled: boolean
  createdAt: string
  updatedAt: string
}

interface RecurrenceRuleResponse {
  id: string
  type: 'daily' | 'weekly' | 'monthly' | 'custom'
  interval: number
  daysOfWeek: number[] | null
  dayOfMonth: number | null
}

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
  recurrenceRuleId: string | null
  recurrenceRule: RecurrenceRuleResponse | null
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

    it('closes open TimeBlocks when status changes away from in_progress', async () => {
      const task = await createTask('Status change')
      await app.request(`/api/tasks/${task.id}/start`, { method: 'POST' })

      // Change status via PATCH /status (not /complete)
      await app.request(`/api/tasks/${task.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })

      const res = await app.request(`/api/tasks/${task.id}`)
      const body = (await res.json()) as TaskResponse & {
        timeBlocks: TimeBlockResponse[]
      }
      expect(body.timeBlocks).toHaveLength(1)
      expect(body.timeBlocks[0]!.endTime).not.toBeNull()
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

    it('returns subtree for rootId', async () => {
      const root = await createTask('Root')
      const child = await createTask('Child', { parentId: root.id })
      await createTask('Grandchild', { parentId: child.id })
      await createTask('Unrelated')

      const res = await app.request(`/api/tasks/tree?rootId=${root.id}`)

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(1)
      expect(body[0]!.title).toBe('Root')
      expect(body[0]!.children).toHaveLength(1)
      expect(body[0]!.children![0]!.title).toBe('Child')
      expect(body[0]!.children![0]!.children).toHaveLength(1)
      expect(body[0]!.children![0]!.children![0]!.title).toBe('Grandchild')
    })

    it('returns deeply nested tree (3+ levels)', async () => {
      const level1 = await createTask('Level 1')
      const level2 = await createTask('Level 2', { parentId: level1.id })
      const level3 = await createTask('Level 3', { parentId: level2.id })
      await createTask('Level 4', { parentId: level3.id })

      const res = await app.request('/api/tasks/tree')

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(1)
      expect(body[0]!.children![0]!.children![0]!.children).toHaveLength(1)
      expect(body[0]!.children![0]!.children![0]!.children![0]!.title).toBe(
        'Level 4',
      )
    })

    it('returns empty array for non-existent rootId', async () => {
      await createTask('Task')

      const res = await app.request(`/api/tasks/tree?rootId=${TEST_UUID}`)

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    })

    it('includes childCompletionCount in tree nodes', async () => {
      const parent = await createTask('Parent')
      await createTask('Child 1', { parentId: parent.id })
      const child2 = await createTask('Child 2', { parentId: parent.id })
      await createTask('Child 3', { parentId: parent.id })

      await app.request(`/api/tasks/${child2.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })

      const res = await app.request('/api/tasks/tree')

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body[0]!.childCompletionCount).toEqual({
        completed: 1,
        total: 3,
      })
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

  describe('POST /api/tasks/:id/start', () => {
    it('sets status to in_progress and creates a TimeBlock', async () => {
      const task = await createTask('Start me')

      const res = await app.request(`/api/tasks/${task.id}/start`, {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse & {
        timeBlock: TimeBlockResponse
      }
      expect(body.status).toBe('in_progress')
      expect(body.timeBlock.taskId).toBe(task.id)
      expect(body.timeBlock.startTime).toBeDefined()
      expect(body.timeBlock.endTime).toBeNull()
    })

    it('returns 409 when task is already in progress', async () => {
      const task = await createTask('Already started')
      await app.request(`/api/tasks/${task.id}/start`, { method: 'POST' })

      const res = await app.request(`/api/tasks/${task.id}/start`, {
        method: 'POST',
      })

      expect(res.status).toBe(409)
    })

    it('returns 404 for non-existent task', async () => {
      const res = await app.request(`/api/tasks/${TEST_UUID}/start`, {
        method: 'POST',
      })

      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/tasks/:id/stop', () => {
    it('sets status to todo and closes open TimeBlocks', async () => {
      const task = await createTask('Stop me')
      await app.request(`/api/tasks/${task.id}/start`, { method: 'POST' })

      const res = await app.request(`/api/tasks/${task.id}/stop`, {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse & {
        closedTimeBlocks: TimeBlockResponse[]
      }
      expect(body.status).toBe('todo')
      expect(body.closedTimeBlocks).toHaveLength(1)
      expect(body.closedTimeBlocks[0]!.endTime).not.toBeNull()
    })

    it('returns 409 when task is not in progress', async () => {
      const task = await createTask('Not started')

      const res = await app.request(`/api/tasks/${task.id}/stop`, {
        method: 'POST',
      })

      expect(res.status).toBe(409)
    })

    it('returns 404 for non-existent task', async () => {
      const res = await app.request(`/api/tasks/${TEST_UUID}/stop`, {
        method: 'POST',
      })

      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/tasks/:id/complete', () => {
    it('sets status to completed and closes open TimeBlocks', async () => {
      const task = await createTask('Complete me')
      await app.request(`/api/tasks/${task.id}/start`, { method: 'POST' })

      const res = await app.request(`/api/tasks/${task.id}/complete`, {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse & {
        closedTimeBlocks: TimeBlockResponse[]
      }
      expect(body.status).toBe('completed')
      expect(body.closedTimeBlocks).toHaveLength(1)
      expect(body.closedTimeBlocks[0]!.endTime).not.toBeNull()
    })

    it('completes a task that was not started (no open TimeBlocks)', async () => {
      const task = await createTask('Direct complete')

      const res = await app.request(`/api/tasks/${task.id}/complete`, {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse & {
        closedTimeBlocks: TimeBlockResponse[]
      }
      expect(body.status).toBe('completed')
      expect(body.closedTimeBlocks).toHaveLength(0)
    })

    it('returns 404 for non-existent task', async () => {
      const res = await app.request(`/api/tasks/${TEST_UUID}/complete`, {
        method: 'POST',
      })

      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/tasks/:id with timeBlocks', () => {
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

  describe('recurrence', () => {
    describe('POST /api/tasks with recurrenceRule', () => {
      it('creates a task with a recurrence rule', async () => {
        const res = await app.request('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Daily standup',
            dueDate: '2026-03-22',
            recurrenceRule: { type: 'daily', interval: 1 },
          }),
        })

        expect(res.status).toBe(201)
        const body = (await res.json()) as TaskResponse
        expect(body.recurrenceRuleId).not.toBeNull()
        expect(body.recurrenceRule).not.toBeNull()
        expect(body.recurrenceRule!.type).toBe('daily')
        expect(body.recurrenceRule!.interval).toBe(1)
      })

      it('creates a task without recurrence rule (backward compat)', async () => {
        const res = await app.request('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Normal task' }),
        })

        expect(res.status).toBe(201)
        const body = (await res.json()) as TaskResponse
        expect(body.recurrenceRuleId).toBeNull()
        expect(body.recurrenceRule).toBeNull()
      })
    })

    describe('PATCH /api/tasks/:id with recurrenceRule', () => {
      it('adds a recurrence rule to an existing task', async () => {
        const task = await createTask('Task')

        const res = await app.request(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recurrenceRule: {
              type: 'weekly',
              interval: 1,
              daysOfWeek: [1, 3, 5],
            },
          }),
        })

        expect(res.status).toBe(200)
        const body = (await res.json()) as TaskResponse
        expect(body.recurrenceRule).not.toBeNull()
        expect(body.recurrenceRule!.type).toBe('weekly')
        expect(body.recurrenceRule!.daysOfWeek).toEqual([1, 3, 5])
      })

      it('updates an existing recurrence rule', async () => {
        const task = await createRecurringTask('Recurring', {
          type: 'daily',
          interval: 1,
        })

        const res = await app.request(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recurrenceRule: { type: 'weekly', interval: 2, daysOfWeek: [1] },
          }),
        })

        expect(res.status).toBe(200)
        const body = (await res.json()) as TaskResponse
        expect(body.recurrenceRule!.type).toBe('weekly')
        expect(body.recurrenceRule!.interval).toBe(2)
        // Same rule ID (updated in place)
        expect(body.recurrenceRuleId).toBe(task.recurrenceRuleId)
      })

      it('removes recurrence rule when set to null', async () => {
        const task = await createRecurringTask('Recurring', {
          type: 'daily',
          interval: 1,
        })

        const res = await app.request(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recurrenceRule: null }),
        })

        expect(res.status).toBe(200)
        const body = (await res.json()) as TaskResponse
        expect(body.recurrenceRuleId).toBeNull()
        expect(body.recurrenceRule).toBeNull()
      })
    })

    describe('GET /api/tasks/:id with recurrence rule', () => {
      it('includes recurrence rule in response', async () => {
        const task = await createRecurringTask('Recurring', {
          type: 'monthly',
          interval: 1,
          dayOfMonth: 15,
        })

        const res = await app.request(`/api/tasks/${task.id}`)

        expect(res.status).toBe(200)
        const body = (await res.json()) as TaskResponse
        expect(body.recurrenceRule).not.toBeNull()
        expect(body.recurrenceRule!.type).toBe('monthly')
        expect(body.recurrenceRule!.dayOfMonth).toBe(15)
      })
    })

    describe('POST /api/tasks/:id/complete with recurrence', () => {
      it('generates next task for daily recurrence', async () => {
        const task = await createRecurringTask(
          'Daily task',
          { type: 'daily', interval: 1 },
          { dueDate: '2026-03-22' },
        )

        const res = await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
        })

        expect(res.status).toBe(200)
        const body = (await res.json()) as TaskResponse & {
          closedTimeBlocks: TimeBlockResponse[]
          nextTask: TaskResponse | null
        }
        expect(body.status).toBe('completed')
        expect(body.nextTask).not.toBeNull()
        expect(body.nextTask!.title).toBe('Daily task')
        expect(body.nextTask!.status).toBe('todo')
        expect(body.nextTask!.dueDate).toBe('2026-03-23')
        expect(body.nextTask!.recurrenceRuleId).toBe(task.recurrenceRuleId)
      })

      it('generates next task for weekly recurrence with daysOfWeek', async () => {
        const task = await createRecurringTask(
          'Weekly task',
          { type: 'weekly', interval: 1, daysOfWeek: [1, 3, 5] },
          { dueDate: '2026-03-23' }, // Monday
        )

        const res = await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
        })

        expect(res.status).toBe(200)
        const body = (await res.json()) as TaskResponse & {
          nextTask: TaskResponse | null
        }
        expect(body.nextTask).not.toBeNull()
        expect(body.nextTask!.dueDate).toBe('2026-03-25') // Wednesday
      })

      it('generates next task for monthly recurrence', async () => {
        const task = await createRecurringTask(
          'Monthly task',
          { type: 'monthly', interval: 1, dayOfMonth: 15 },
          { dueDate: '2026-03-15' },
        )

        const res = await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
        })

        expect(res.status).toBe(200)
        const body = (await res.json()) as TaskResponse & {
          nextTask: TaskResponse | null
        }
        expect(body.nextTask).not.toBeNull()
        expect(body.nextTask!.dueDate).toBe('2026-04-15')
      })

      it('does not generate next task for non-recurring task', async () => {
        const task = await createTask('Normal task')

        const res = await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
        })

        expect(res.status).toBe(200)
        const body = (await res.json()) as TaskResponse & {
          nextTask: TaskResponse | null
        }
        expect(body.nextTask).toBeNull()
      })

      it('does not generate next task after recurrence rule is removed', async () => {
        const task = await createRecurringTask(
          'Was recurring',
          { type: 'daily', interval: 1 },
          { dueDate: '2026-03-22' },
        )

        // Remove recurrence rule
        await app.request(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recurrenceRule: null }),
        })

        const res = await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
        })

        expect(res.status).toBe(200)
        const body = (await res.json()) as TaskResponse & {
          nextTask: TaskResponse | null
        }
        expect(body.nextTask).toBeNull()
      })

      it('copies task properties to next instance', async () => {
        const task = await createRecurringTask(
          'Recurring with details',
          { type: 'daily', interval: 1 },
          {
            dueDate: '2026-03-22',
            description: 'Important recurring task',
            estimatedMinutes: 30,
            context: 'work',
          },
        )

        const res = await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
        })

        expect(res.status).toBe(200)
        const body = (await res.json()) as TaskResponse & {
          nextTask: TaskResponse | null
        }
        expect(body.nextTask).not.toBeNull()
        expect(body.nextTask!.description).toBe('Important recurring task')
        expect(body.nextTask!.estimatedMinutes).toBe(30)
        expect(body.nextTask!.context).toBe('work')
      })
    })
  })

  describe('parallel task execution', () => {
    it('allows multiple tasks to be in_progress simultaneously', async () => {
      const task1 = await createTask('Task 1')
      const task2 = await createTask('Task 2')

      await app.request(`/api/tasks/${task1.id}/start`, { method: 'POST' })
      await app.request(`/api/tasks/${task2.id}/start`, { method: 'POST' })

      const res1 = await app.request(`/api/tasks/${task1.id}`)
      const res2 = await app.request(`/api/tasks/${task2.id}`)

      const body1 = (await res1.json()) as TaskResponse
      const body2 = (await res2.json()) as TaskResponse
      expect(body1.status).toBe('in_progress')
      expect(body2.status).toBe('in_progress')
    })
  })
})

async function createTask(
  title: string,
  opts: {
    parentId?: string
    description?: string
    dueDate?: string
    estimatedMinutes?: number
    context?: string
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
  return (await res.json()) as TaskResponse
}

async function createRecurringTask(
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
      `Failed to create recurring task: ${res.status} ${await res.text()}`,
    )
  }
  return (await res.json()) as TaskResponse
}
