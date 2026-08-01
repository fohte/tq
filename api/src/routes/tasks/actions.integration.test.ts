import { asc, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { taskEvents } from '#db/schema'
import {
  createRecurringTask,
  createTask,
  TaskResponse,
  TEST_UUID,
} from '#routes/tasks/testing'
import { assertDefined, jsonBody, setupTestDb } from '#testing'

setupTestDb()

async function setStatus(
  taskId: string,
  status: string,
  headers: Record<string, string> = {},
) {
  return app.request(`/api/tasks/${taskId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ status }),
  })
}

interface TaskEventFields {
  type: 'status_changed' | 'github_linked' | 'github_unlinked'
  fromStatus: 'todo' | 'in_progress' | 'completed' | null
  toStatus: 'todo' | 'in_progress' | 'completed' | null
  authorKind: 'human' | 'llm' | 'system'
  authorAgent: string | null
}

async function fetchTaskEvents(taskId: string): Promise<TaskEventFields[]> {
  const rows = await db
    .select()
    .from(taskEvents)
    .where(eq(taskEvents.taskId, taskId))
    .orderBy(asc(taskEvents.id))
  return rows.map((row) => ({
    type: row.type,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    authorKind: row.authorKind,
    authorAgent: row.authorAgent,
  }))
}

describe('tasks actions API', () => {
  describe('PATCH /api/tasks/:id/status', () => {
    it('updates task status', async () => {
      const created = await createTask('Task')

      const res = await setStatus(created.id, 'in_progress')

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.status).toBe('in_progress')
    })

    it('returns 404 for non-existent task', async () => {
      const res = await setStatus(TEST_UUID, 'completed')

      expect(res.status).toBe(404)
    })

    it('accepts the task number in place of the UUID', async () => {
      const created = await createTask('Task')

      const res = await app.request(
        `/api/tasks/${String(created.number)}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'in_progress' }),
        },
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.id).toBe(created.id)
      expect(body.status).toBe('in_progress')
    })

    it('returns 400 for invalid status', async () => {
      const created = await createTask('Task')

      const res = await setStatus(created.id, 'invalid')

      expect(res.status).toBe(400)
    })

    it('succeeds when re-setting the same status (idempotent)', async () => {
      const created = await createTask('Task')
      await setStatus(created.id, 'in_progress')

      const res = await setStatus(created.id, 'in_progress')

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.status).toBe('in_progress')
    })
  })

  describe('task_events recording', () => {
    it('records a status_changed event when the status actually changes', async () => {
      const task = await createTask('Task')

      await setStatus(task.id, 'in_progress')

      expect(await fetchTaskEvents(task.id)).toEqual([
        {
          type: 'status_changed',
          fromStatus: 'todo',
          toStatus: 'in_progress',
          authorKind: 'human',
          authorAgent: null,
        },
      ])
    })

    it('does not record when re-setting the same status (idempotent)', async () => {
      const task = await createTask('Task')
      await setStatus(task.id, 'in_progress')

      await setStatus(task.id, 'in_progress')

      expect(await fetchTaskEvents(task.id)).toEqual([
        {
          type: 'status_changed',
          fromStatus: 'todo',
          toStatus: 'in_progress',
          authorKind: 'human',
          authorAgent: null,
        },
      ])
    })

    it('records the author from the X-Author header', async () => {
      const task = await createTask('Task')

      await setStatus(task.id, 'in_progress', {
        'X-Author': 'llm:claude-opus-5',
      })

      expect(await fetchTaskEvents(task.id)).toEqual([
        {
          type: 'status_changed',
          fromStatus: 'todo',
          toStatus: 'in_progress',
          authorKind: 'llm',
          authorAgent: 'claude-opus-5',
        },
      ])
    })

    it('records a status_changed event via POST /:id/complete', async () => {
      const task = await createTask('Task')

      const res = await app.request(`/api/tasks/${task.id}/complete`, {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      expect(await fetchTaskEvents(task.id)).toEqual([
        {
          type: 'status_changed',
          fromStatus: 'todo',
          toStatus: 'completed',
          authorKind: 'human',
          authorAgent: null,
        },
      ])
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
      const body = await jsonBody<TaskResponse>(res)
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
      const body = await jsonBody<TaskResponse>(res)
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

  describe('POST /api/tasks/:id/complete', () => {
    it('sets status to completed', async () => {
      const task = await createTask('Complete me')

      const res = await app.request(`/api/tasks/${task.id}/complete`, {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.status).toBe('completed')
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
      const body = await jsonBody<
        TaskResponse & { nextTask: TaskResponse | null }
      >(res)
      expect(body.status).toBe('completed')
      assertDefined(body.nextTask)
      expect(body.nextTask.title).toBe('Daily task')
      expect(body.nextTask.status).toBe('todo')
      expect(body.nextTask.dueDate).toBe('2026-03-23')
      expect(body.nextTask.recurrenceRuleId).toBe(task.recurrenceRuleId)
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
      const body = await jsonBody<
        TaskResponse & { nextTask: TaskResponse | null }
      >(res)
      assertDefined(body.nextTask)
      expect(body.nextTask.dueDate).toBe('2026-03-25') // Wednesday
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
      const body = await jsonBody<
        TaskResponse & { nextTask: TaskResponse | null }
      >(res)
      assertDefined(body.nextTask)
      expect(body.nextTask.dueDate).toBe('2026-04-15')
    })

    it('does not generate next task for non-recurring task', async () => {
      const task = await createTask('Normal task')

      const res = await app.request(`/api/tasks/${task.id}/complete`, {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<
        TaskResponse & { nextTask: TaskResponse | null }
      >(res)
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
      const body = await jsonBody<
        TaskResponse & { nextTask: TaskResponse | null }
      >(res)
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
      const body = await jsonBody<
        TaskResponse & { nextTask: TaskResponse | null }
      >(res)
      assertDefined(body.nextTask)
      expect(body.nextTask.description).toBe('Important recurring task')
      expect(body.nextTask.estimatedMinutes).toBe(30)
      expect(body.nextTask.context).toBe('work')
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
      const body = await jsonBody<
        TaskResponse & { nextTask: TaskResponse | null }
      >(res)
      assertDefined(body.recurrenceRule)
      expect(body.recurrenceRule.type).toBe('daily')
    })
  })

  describe('parallel task execution', () => {
    it('allows multiple tasks to be in_progress simultaneously', async () => {
      const task1 = await createTask('Task 1')
      const task2 = await createTask('Task 2')

      await setStatus(task1.id, 'in_progress')
      await setStatus(task2.id, 'in_progress')

      const res1 = await app.request(`/api/tasks/${task1.id}`)
      const res2 = await app.request(`/api/tasks/${task2.id}`)

      const body1 = await jsonBody<TaskResponse>(res1)
      const body2 = await jsonBody<TaskResponse>(res2)
      expect(body1.status).toBe('in_progress')
      expect(body2.status).toBe('in_progress')
    })
  })
})
