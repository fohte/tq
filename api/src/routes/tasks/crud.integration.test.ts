import { app } from '@api/app'
import {
  createRecurringTask,
  createTask,
  TaskResponse,
  TEST_UUID,
  TimeBlockResponse,
} from '@api/routes/tasks/testing'
import { assertDefined, jsonBody, setupTestDb } from '@api/testing'
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
      const body = await jsonBody<TaskResponse>(res)
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
      const body = await jsonBody<TaskResponse>(res)
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
      const body = await jsonBody<TaskResponse[]>(res)
      expect(body).toHaveLength(2)
    })

    it('filters by parentId', async () => {
      const parent = await createTask('Parent')
      await createTask('Child 1', { parentId: parent.id })
      await createTask('Child 2', { parentId: parent.id })
      await createTask('Orphan')

      const res = await app.request(`/api/tasks?parentId=${parent.id}`)

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse[]>(res)
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
      const body = await jsonBody<TaskResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].title).toBe('Task B')
    })
  })

  describe('GET /api/tasks/:id', () => {
    it('returns a task by ID', async () => {
      const created = await createTask('My task')

      const res = await app.request(`/api/tasks/${created.id}`)

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
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
      const body = await jsonBody<TaskResponse>(res)
      expect(body.childCompletionCount).toEqual({ completed: 1, total: 2 })
    })

    it('includes timeBlocks in response', async () => {
      const task = await createTask('With blocks')
      await app.request(`/api/tasks/${task.id}/start`, { method: 'POST' })
      await app.request(`/api/tasks/${task.id}/stop`, { method: 'POST' })
      await app.request(`/api/tasks/${task.id}/start`, { method: 'POST' })

      const res = await app.request(`/api/tasks/${task.id}`)

      expect(res.status).toBe(200)
      const body = await jsonBody<
        TaskResponse & { timeBlocks: TimeBlockResponse[] }
      >(res)
      expect(body.timeBlocks).toHaveLength(2)
      // First block is closed, second is open
      assertDefined(body.timeBlocks[0])
      assertDefined(body.timeBlocks[1])
      expect(body.timeBlocks[0].endTime).not.toBeNull()
      expect(body.timeBlocks[1].endTime).toBeNull()
    })

    it('returns empty timeBlocks when task has none', async () => {
      const task = await createTask('No blocks')

      const res = await app.request(`/api/tasks/${task.id}`)

      expect(res.status).toBe(200)
      const body = await jsonBody<
        TaskResponse & { timeBlocks: TimeBlockResponse[] }
      >(res)
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
      const body = await jsonBody<TaskResponse>(res)
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
      const body = await jsonBody<TaskResponse>(res)
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
      const body = await jsonBody<TaskResponse>(res)
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
      const body = await jsonBody<TaskResponse>(res)
      expect(body.parentId).toBeNull()
    })

    it('cleans up orphaned recurrence rule on delete', async () => {
      const task = await createRecurringTask('Recurring to delete', {
        type: 'daily',
        interval: 1,
      })
      assertDefined(task.recurrenceRuleId)
      const ruleId = task.recurrenceRuleId

      await app.request(`/api/tasks/${task.id}`, { method: 'DELETE' })

      // Creating a new recurring task should get a different rule ID
      const newTask = await createRecurringTask('New recurring', {
        type: 'daily',
        interval: 1,
      })
      expect(newTask.recurrenceRuleId).not.toBe(ruleId)
    })

    it('does not delete shared recurrence rule when deleting task', async () => {
      // Create a recurring task and complete it to generate next instance
      const task = await createRecurringTask(
        'Shared rule delete test',
        { type: 'daily', interval: 1 },
        { dueDate: '2026-03-22' },
      )

      const completeRes = await app.request(`/api/tasks/${task.id}/complete`, {
        method: 'POST',
      })
      const completeBody = await jsonBody<
        TaskResponse & { nextTask: TaskResponse | null }
      >(completeRes)
      assertDefined(completeBody.nextTask)
      const nextTask = completeBody.nextTask

      // Delete the completed task
      await app.request(`/api/tasks/${task.id}`, { method: 'DELETE' })

      // The next active task should still have its recurrence rule intact
      const nextRes = await app.request(`/api/tasks/${nextTask.id}`)
      const nextBody = await jsonBody<TaskResponse>(nextRes)
      expect(nextBody.recurrenceRuleId).toBe(task.recurrenceRuleId)
      expect(nextBody.recurrenceRule).not.toBeNull()
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
        const body = await jsonBody<TaskResponse>(res)
        expect(body.recurrenceRuleId).not.toBeNull()
        assertDefined(body.recurrenceRule)
        expect(body.recurrenceRule.type).toBe('daily')
        expect(body.recurrenceRule.interval).toBe(1)
      })

      it('creates a task without recurrence rule (backward compat)', async () => {
        const res = await app.request('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Normal task' }),
        })

        expect(res.status).toBe(201)
        const body = await jsonBody<TaskResponse>(res)
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
        const body = await jsonBody<TaskResponse>(res)
        assertDefined(body.recurrenceRule)
        expect(body.recurrenceRule.type).toBe('weekly')
        expect(body.recurrenceRule.daysOfWeek).toEqual([1, 3, 5])
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
        const body = await jsonBody<TaskResponse>(res)
        assertDefined(body.recurrenceRule)
        expect(body.recurrenceRule.type).toBe('weekly')
        expect(body.recurrenceRule.interval).toBe(2)
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
        const body = await jsonBody<TaskResponse>(res)
        expect(body.recurrenceRuleId).toBeNull()
        expect(body.recurrenceRule).toBeNull()
      })

      it('creates new rule instead of mutating shared rule', async () => {
        // Create a recurring task and complete it so both tasks share the rule
        const task = await createRecurringTask(
          'Shared rule update test',
          { type: 'daily', interval: 1 },
          { dueDate: '2026-03-22' },
        )

        const completeRes = await app.request(
          `/api/tasks/${task.id}/complete`,
          { method: 'POST' },
        )
        const completeBody = await jsonBody<
          TaskResponse & { nextTask: TaskResponse | null }
        >(completeRes)
        assertDefined(completeBody.nextTask)
        const nextTask = completeBody.nextTask
        assertDefined(task.recurrenceRuleId)
        const originalRuleId = task.recurrenceRuleId

        // Update the recurrence rule on the next task
        const patchRes = await app.request(`/api/tasks/${nextTask.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recurrenceRule: { type: 'weekly', interval: 1, daysOfWeek: [1] },
          }),
        })

        expect(patchRes.status).toBe(200)
        const patchBody = await jsonBody<TaskResponse>(patchRes)
        // Should get a NEW rule ID since the old one was shared
        expect(patchBody.recurrenceRuleId).not.toBe(originalRuleId)
        assertDefined(patchBody.recurrenceRule)
        expect(patchBody.recurrenceRule.type).toBe('weekly')

        // The completed task should still reference the original rule
        const origRes = await app.request(`/api/tasks/${task.id}`)
        const origBody = await jsonBody<TaskResponse>(origRes)
        expect(origBody.recurrenceRuleId).toBe(originalRuleId)
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
        const body = await jsonBody<TaskResponse>(res)
        assertDefined(body.recurrenceRule)
        expect(body.recurrenceRule.type).toBe('monthly')
        expect(body.recurrenceRule.dayOfMonth).toBe(15)
      })
    })

    describe('PATCH /api/tasks/:id recurrence rule removal', () => {
      it('deletes orphaned recurrence rule record when no other task uses it', async () => {
        const task = await createRecurringTask('Recurring', {
          type: 'daily',
          interval: 1,
        })
        assertDefined(task.recurrenceRuleId)
        const ruleId = task.recurrenceRuleId

        // Remove recurrence rule
        await app.request(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recurrenceRule: null }),
        })

        // Verify the rule was removed from the task
        const getRes = await app.request(`/api/tasks/${task.id}`)
        const body = await jsonBody<TaskResponse>(getRes)
        expect(body.recurrenceRuleId).toBeNull()

        // Create a new task with the same rule type to verify old rule is gone
        // by checking that a new rule gets a different ID
        const newTask = await createRecurringTask('New recurring', {
          type: 'daily',
          interval: 1,
        })
        expect(newTask.recurrenceRuleId).not.toBe(ruleId)
      })

      it('does not delete shared recurrence rule when another task uses it', async () => {
        // Create a recurring task and complete it to generate next instance
        const task = await createRecurringTask(
          'Shared rule task',
          { type: 'daily', interval: 1 },
          { dueDate: '2026-03-22' },
        )

        const completeRes = await app.request(
          `/api/tasks/${task.id}/complete`,
          { method: 'POST' },
        )
        const completeBody = await jsonBody<
          TaskResponse & { nextTask: TaskResponse | null }
        >(completeRes)
        assertDefined(completeBody.nextTask)
        const nextTask = completeBody.nextTask
        expect(nextTask.recurrenceRuleId).toBe(task.recurrenceRuleId)

        // Remove recurrence from the completed task
        await app.request(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recurrenceRule: null }),
        })

        // The next active task should still have its recurrence rule intact
        const nextRes = await app.request(`/api/tasks/${nextTask.id}`)
        const nextBody = await jsonBody<TaskResponse>(nextRes)
        expect(nextBody.recurrenceRuleId).toBe(task.recurrenceRuleId)
        expect(nextBody.recurrenceRule).not.toBeNull()
      })
    })
  })
})
