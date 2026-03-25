import { app } from '@api/app'
import {
  createRecurringTask,
  createTask,
  TaskResponse,
  TEST_UUID,
  TimeBlockResponse,
} from '@api/routes/tasks/testing'
import { setupTestDb } from '@api/testing'
import { describe, expect, it } from 'vitest'

setupTestDb()

describe('tasks actions API', () => {
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

    it('returns 409 when task is already completed', async () => {
      const task = await createTask('Already done')
      await app.request(`/api/tasks/${task.id}/complete`, { method: 'POST' })

      const res = await app.request(`/api/tasks/${task.id}/complete`, {
        method: 'POST',
      })

      expect(res.status).toBe(409)
    })

    it('returns 404 for non-existent task', async () => {
      const res = await app.request(`/api/tasks/${TEST_UUID}/complete`, {
        method: 'POST',
      })

      expect(res.status).toBe(404)
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

    it('includes recurrenceRule in completed task response', async () => {
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
        nextTask: TaskResponse | null
      }
      expect(body.recurrenceRule).not.toBeNull()
      expect(body.recurrenceRule!.type).toBe('daily')
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
