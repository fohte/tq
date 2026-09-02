import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { taskRelations, tasks } from '#db/schema'
import {
  createLabel,
  createRecurringTask,
  createTask,
  fetchTaskEvents,
  TaskListItemResponse,
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

describe('tasks actions API', () => {
  describe('PATCH /api/tasks/:id/status', () => {
    it('updates task status', async () => {
      const created = await createTask('Task')

      const res = await setStatus(created.id, 'completed')

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.status).toBe('completed')
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
          body: JSON.stringify({ status: 'completed' }),
        },
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.id).toBe(created.id)
      expect(body.status).toBe('completed')
    })

    it('returns 400 for invalid status', async () => {
      const created = await createTask('Task')

      const res = await setStatus(created.id, 'invalid')

      expect(res.status).toBe(400)
    })

    it('succeeds when re-setting the same status (idempotent)', async () => {
      const created = await createTask('Task')
      await setStatus(created.id, 'completed')

      const res = await setStatus(created.id, 'completed')

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.status).toBe('completed')
    })

    it('keeps the labels in the response', async () => {
      await createLabel('urgent')
      const created = await createTask('Task', { labels: ['urgent'] })

      const res = await setStatus(created.id, 'completed')

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.labels).toEqual(['urgent'])
    })

    it('defaults statusReason to completed when moving to completed with no statusReason in the body', async () => {
      const created = await createTask('Task')

      const res = await setStatus(created.id, 'completed')

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.statusReason).toBe('completed')
    })

    it('clears statusReason when moving a completed task back to todo', async () => {
      const created = await createTask('Task')
      const completeRes = await app.request(`/api/tasks/${created.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          statusReason: 'not_planned',
        }),
      })
      const completedBody = await jsonBody<TaskResponse>(completeRes)
      expect(completedBody.statusReason).toBe('not_planned')

      const res = await setStatus(created.id, 'todo')

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.statusReason).toBeNull()

      const [dbTask] = await db
        .select({ statusReason: tasks.statusReason })
        .from(tasks)
        .where(eq(tasks.id, created.id))
      assertDefined(dbTask)
      expect(dbTask.statusReason).toBeNull()
    })
  })

  describe('task_events recording', () => {
    it('records a status_changed event when the status actually changes', async () => {
      const task = await createTask('Task')

      await setStatus(task.id, 'completed')

      expect(await fetchTaskEvents(task.id)).toEqual([
        {
          type: 'status_changed',
          fromStatus: 'todo',
          toStatus: 'completed',
          toStatusReason: 'completed',
          githubOwner: null,
          githubRepo: null,
          githubNumber: null,
          githubKind: null,
          authorKind: 'human',
          authorAgent: null,
        },
      ])
    })

    it('does not record when re-setting the same status (idempotent)', async () => {
      const task = await createTask('Task')
      await setStatus(task.id, 'completed')

      await setStatus(task.id, 'completed')

      expect(await fetchTaskEvents(task.id)).toEqual([
        {
          type: 'status_changed',
          fromStatus: 'todo',
          toStatus: 'completed',
          toStatusReason: 'completed',
          githubOwner: null,
          githubRepo: null,
          githubNumber: null,
          githubKind: null,
          authorKind: 'human',
          authorAgent: null,
        },
      ])
    })

    it('records the author from the X-Author header', async () => {
      const task = await createTask('Task')

      await setStatus(task.id, 'completed', {
        'X-Author': 'llm:claude-opus-5',
      })

      expect(await fetchTaskEvents(task.id)).toEqual([
        {
          type: 'status_changed',
          fromStatus: 'todo',
          toStatus: 'completed',
          toStatusReason: 'completed',
          githubOwner: null,
          githubRepo: null,
          githubNumber: null,
          githubKind: null,
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
          toStatusReason: 'completed',
          githubOwner: null,
          githubRepo: null,
          githubNumber: null,
          githubKind: null,
          authorKind: 'human',
          authorAgent: null,
        },
      ])
    })

    it('records the given statusReason via POST /:id/complete', async () => {
      const task = await createTask('Task')

      const res = await app.request(`/api/tasks/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusReason: 'duplicate' }),
      })

      expect(res.status).toBe(200)
      expect(await fetchTaskEvents(task.id)).toEqual([
        {
          type: 'status_changed',
          fromStatus: 'todo',
          toStatus: 'completed',
          toStatusReason: 'duplicate',
          githubOwner: null,
          githubRepo: null,
          githubNumber: null,
          githubKind: null,
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

    it('sets parent task given as a task number', async () => {
      const parent = await createTask('Parent')
      const child = await createTask('Child')

      const res = await app.request(`/api/tasks/${child.id}/parent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: String(parent.number) }),
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

    it('keeps the labels in the response', async () => {
      await createLabel('urgent')
      const parent = await createTask('Parent')
      const child = await createTask('Child', { labels: ['urgent'] })

      const res = await app.request(`/api/tasks/${child.id}/parent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: parent.id }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.labels).toEqual(['urgent'])
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

    it('defaults statusReason to completed when no body is sent', async () => {
      const task = await createTask('Complete me')

      const res = await app.request(`/api/tasks/${task.id}/complete`, {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.statusReason).toBe('completed')
    })

    it('defaults statusReason to completed when the body is {}', async () => {
      const task = await createTask('Complete me')

      const res = await app.request(`/api/tasks/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.statusReason).toBe('completed')
    })

    it('sets statusReason to not_planned when given in the body', async () => {
      const task = await createTask('Complete me')

      const res = await app.request(`/api/tasks/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusReason: 'not_planned' }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.statusReason).toBe('not_planned')
    })

    it('sets statusReason to duplicate when given in the body', async () => {
      const task = await createTask('Complete me')

      const res = await app.request(`/api/tasks/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusReason: 'duplicate' }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.statusReason).toBe('duplicate')
    })

    it('keeps the labels in the response', async () => {
      await createLabel('urgent')
      const task = await createTask('Complete me', { labels: ['urgent'] })

      const res = await app.request(`/api/tasks/${task.id}/complete`, {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.labels).toEqual(['urgent'])
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

  describe('tasks_status_reason_check constraint', () => {
    it('rejects a non-null statusReason on a non-completed task', async () => {
      const task = await createTask('Task')

      await expect(
        db
          .update(tasks)
          .set({ status: 'todo', statusReason: 'not_planned' })
          .where(eq(tasks.id, task.id)),
      ).rejects.toThrow()
    })
  })

  describe('duplicate_of relation', () => {
    function fetchDuplicateOfRelations(sourceTaskId: string) {
      return db
        .select({
          sourceTaskId: taskRelations.sourceTaskId,
          targetTaskId: taskRelations.targetTaskId,
          type: taskRelations.type,
        })
        .from(taskRelations)
        .where(eq(taskRelations.sourceTaskId, sourceTaskId))
    }

    describe('POST /api/tasks/:id/complete', () => {
      it('persists a task_relations row when closing with a duplicate target', async () => {
        const target = await createTask('Target')
        const task = await createTask('Duplicate me')

        const res = await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            statusReason: 'duplicate',
            duplicateOfTaskId: target.id,
          }),
        })
        expect(res.status).toBe(200)

        expect(await fetchDuplicateOfRelations(task.id)).toEqual([
          {
            sourceTaskId: task.id,
            targetTaskId: target.id,
            type: 'duplicate_of',
          },
        ])
      })

      it('surfaces duplicateOfNumber/duplicateOfTask in the detail response', async () => {
        const target = await createTask('Target')
        const task = await createTask('Duplicate me')

        await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            statusReason: 'duplicate',
            duplicateOfTaskId: target.id,
          }),
        })

        const detailRes = await app.request(`/api/tasks/${task.id}`)
        const detailBody = await jsonBody<TaskResponse>(detailRes)
        expect(detailBody.duplicateOfNumber).toBe(target.number)
        assertDefined(detailBody.duplicateOfTask)
        expect(detailBody.duplicateOfTask.id).toBe(target.id)
      })

      it('surfaces duplicateOfNumber in the list response', async () => {
        const target = await createTask('Target')
        const task = await createTask('Duplicate me')

        await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            statusReason: 'duplicate',
            duplicateOfTaskId: target.id,
          }),
        })

        const listRes = await app.request('/api/tasks')
        const listBody = await jsonBody<TaskListItemResponse[]>(listRes)
        const listItem = listBody.find((t) => t.id === task.id)
        assertDefined(listItem)
        expect(listItem.duplicateOfNumber).toBe(target.number)
      })

      it('succeeds with no relation row when duplicateOfTaskId is omitted', async () => {
        const task = await createTask('Duplicate me')

        const res = await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ statusReason: 'duplicate' }),
        })
        expect(res.status).toBe(200)

        expect(await fetchDuplicateOfRelations(task.id)).toEqual([])

        const detailRes = await app.request(`/api/tasks/${task.id}`)
        const detailBody = await jsonBody<TaskResponse>(detailRes)
        expect(detailBody.duplicateOfNumber).toBeNull()
        expect(detailBody.duplicateOfTask).toBeNull()
      })

      it('returns 400 when duplicateOfTaskId is the task itself', async () => {
        const task = await createTask('Duplicate me')

        const res = await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            statusReason: 'duplicate',
            duplicateOfTaskId: task.id,
          }),
        })

        expect(res.status).toBe(400)
        expect(await fetchDuplicateOfRelations(task.id)).toEqual([])
      })

      it('returns 404 when duplicateOfTaskId does not reference an existing task', async () => {
        const task = await createTask('Duplicate me')

        const res = await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            statusReason: 'duplicate',
            duplicateOfTaskId: TEST_UUID,
          }),
        })

        expect(res.status).toBe(404)
      })

      it('ignores duplicateOfTaskId when the reason is not duplicate', async () => {
        const target = await createTask('Target')
        const task = await createTask('Not actually a duplicate')

        const res = await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            statusReason: 'not_planned',
            duplicateOfTaskId: target.id,
          }),
        })

        expect(res.status).toBe(200)
        expect(await fetchDuplicateOfRelations(task.id)).toEqual([])
      })
    })

    describe('PATCH /api/tasks/:id/status', () => {
      it('creates a task_relations row when closing with a duplicate target', async () => {
        const target = await createTask('Target')
        const task = await createTask('Duplicate me')

        const res = await app.request(`/api/tasks/${task.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'completed',
            statusReason: 'duplicate',
            duplicateOfTaskId: target.id,
          }),
        })
        expect(res.status).toBe(200)

        expect(await fetchDuplicateOfRelations(task.id)).toEqual([
          {
            sourceTaskId: task.id,
            targetTaskId: target.id,
            type: 'duplicate_of',
          },
        ])
      })

      // Re-closing a task as a duplicate of the same target is a realistic
      // idempotent retry (e.g. a client resending after a dropped response),
      // not an error: `type` is part of task_relations' primary key, so this
      // exercises the `onConflictDoNothing` path rather than a real conflict.
      it('does not error when closing twice as a duplicate of the same target', async () => {
        const target = await createTask('Target')
        const task = await createTask('Duplicate me')
        const body = JSON.stringify({
          status: 'completed',
          statusReason: 'duplicate',
          duplicateOfTaskId: target.id,
        })

        const first = await app.request(`/api/tasks/${task.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
        expect(first.status).toBe(200)

        const second = await app.request(`/api/tasks/${task.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
        expect(second.status).toBe(200)

        expect(await fetchDuplicateOfRelations(task.id)).toEqual([
          {
            sourceTaskId: task.id,
            targetTaskId: target.id,
            type: 'duplicate_of',
          },
        ])
      })
    })

    describe('stale duplicateOf display after reopen/reclose', () => {
      async function closeAsDuplicate(taskId: string, targetId: string) {
        return app.request(`/api/tasks/${taskId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'completed',
            statusReason: 'duplicate',
            duplicateOfTaskId: targetId,
          }),
        })
      }

      it('clears duplicateOfNumber/duplicateOfTask in the detail response after reopening', async () => {
        const target = await createTask('Target')
        const task = await createTask('Duplicate me')
        await closeAsDuplicate(task.id, target.id)

        const reopenRes = await app.request(`/api/tasks/${task.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'todo' }),
        })
        expect(reopenRes.status).toBe(200)

        // The relation row is kept, only the exposed fields are gated.
        expect(await fetchDuplicateOfRelations(task.id)).toEqual([
          {
            sourceTaskId: task.id,
            targetTaskId: target.id,
            type: 'duplicate_of',
          },
        ])

        const detailRes = await app.request(`/api/tasks/${task.id}`)
        const detailBody = await jsonBody<TaskResponse>(detailRes)
        expect(detailBody.duplicateOfNumber).toBeNull()
        expect(detailBody.duplicateOfTask).toBeNull()
      })

      it('clears duplicateOfNumber in the list response after reopening', async () => {
        const target = await createTask('Target')
        const task = await createTask('Duplicate me')
        await closeAsDuplicate(task.id, target.id)

        await app.request(`/api/tasks/${task.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'todo' }),
        })

        const listRes = await app.request('/api/tasks')
        const listBody = await jsonBody<TaskListItemResponse[]>(listRes)
        const listItem = listBody.find((t) => t.id === task.id)
        assertDefined(listItem)
        expect(listItem.duplicateOfNumber).toBeNull()
      })

      it('clears duplicateOfNumber/duplicateOfTask in the detail response after reclosing as not_planned', async () => {
        const target = await createTask('Target')
        const task = await createTask('Duplicate me')
        await closeAsDuplicate(task.id, target.id)

        const recloseRes = await app.request(`/api/tasks/${task.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'completed',
            statusReason: 'not_planned',
          }),
        })
        expect(recloseRes.status).toBe(200)

        // The earlier `duplicate_of` relation row is kept, only the exposed
        // fields are gated.
        expect(await fetchDuplicateOfRelations(task.id)).toEqual([
          {
            sourceTaskId: task.id,
            targetTaskId: target.id,
            type: 'duplicate_of',
          },
        ])

        const detailRes = await app.request(`/api/tasks/${task.id}`)
        const detailBody = await jsonBody<TaskResponse>(detailRes)
        expect(detailBody.duplicateOfNumber).toBeNull()
        expect(detailBody.duplicateOfTask).toBeNull()
      })

      it('clears duplicateOfNumber in the list response after reclosing as not_planned', async () => {
        const target = await createTask('Target')
        const task = await createTask('Duplicate me')
        await closeAsDuplicate(task.id, target.id)

        await app.request(`/api/tasks/${task.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'completed',
            statusReason: 'not_planned',
          }),
        })

        const listRes = await app.request('/api/tasks')
        const listBody = await jsonBody<TaskListItemResponse[]>(listRes)
        const listItem = listBody.find((t) => t.id === task.id)
        assertDefined(listItem)
        expect(listItem.duplicateOfNumber).toBeNull()
      })
    })

    describe('task_relations_no_self_relation constraint', () => {
      // No route ever writes a same-id row (both handlers reject
      // `duplicateOfTaskId === id` with a 400 before touching the
      // database), so this constraint has no public-API path to exercise
      // it — inserted directly to guard the schema invariant itself, as
      // with `task_links_no_self_link` (task-content.ts).
      it('rejects a raw same-id insert', async () => {
        const task = await createTask('Task')

        await expect(
          db.insert(taskRelations).values({
            sourceTaskId: task.id,
            targetTaskId: task.id,
            type: 'duplicate_of',
          }),
        ).rejects.toThrow()
      })
    })
  })

  describe('blocked_by completion guard', () => {
    function setBlockedBy(taskId: string, blockedBy: string[]) {
      return app.request(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockedBy }),
      })
    }

    describe('POST /api/tasks/:id/complete', () => {
      it('returns 409 with blockedByNumbers when a blocker is incomplete', async () => {
        const blocker = await createTask('Blocker')
        const task = await createTask('Blocked')
        await setBlockedBy(task.id, [blocker.id])

        const res = await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
        })

        expect(res.status).toBe(409)
        expect(
          await jsonBody<{ error: string; blockedByNumbers: number[] }>(res),
        ).toEqual({
          error: `Task is blocked by incomplete tasks: #${String(blocker.number)}`,
          blockedByNumbers: [blocker.number],
        })

        const [dbTask] = await db
          .select({ status: tasks.status })
          .from(tasks)
          .where(eq(tasks.id, task.id))
        assertDefined(dbTask)
        expect(dbTask.status).toBe('todo')
      })

      it('lists every incomplete blocker, ordered by number', async () => {
        const blockerA = await createTask('Blocker A')
        const blockerB = await createTask('Blocker B')
        const task = await createTask('Blocked')
        await setBlockedBy(task.id, [blockerB.id, blockerA.id])

        const res = await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
        })

        expect(res.status).toBe(409)
        expect(
          await jsonBody<{ error: string; blockedByNumbers: number[] }>(res),
        ).toEqual({
          error: `Task is blocked by incomplete tasks: #${String(blockerA.number)}, #${String(blockerB.number)}`,
          blockedByNumbers: [blockerA.number, blockerB.number],
        })
      })

      it('succeeds once every blocker is completed', async () => {
        const blocker = await createTask('Blocker')
        const task = await createTask('Blocked')
        await setBlockedBy(task.id, [blocker.id])
        await app.request(`/api/tasks/${blocker.id}/complete`, {
          method: 'POST',
        })

        const res = await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
        })

        expect(res.status).toBe(200)
        const body = await jsonBody<TaskResponse>(res)
        expect(body.status).toBe('completed')
      })

      it('keeps rejecting with "already completed", not the blocked-by error, once a blocker is added after closing', async () => {
        const blocker = await createTask('Blocker')
        const task = await createTask('Blocked')
        await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
        })
        await setBlockedBy(task.id, [blocker.id])

        const res = await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
        })

        expect(res.status).toBe(409)
        expect(await jsonBody<{ error: string }>(res)).toEqual({
          error: 'Task is already completed',
        })
      })
    })

    describe('PATCH /api/tasks/:id/status', () => {
      it('returns 409 with blockedByNumbers when closing while a blocker is incomplete', async () => {
        const blocker = await createTask('Blocker')
        const task = await createTask('Blocked')
        await setBlockedBy(task.id, [blocker.id])

        const res = await setStatus(task.id, 'completed')

        expect(res.status).toBe(409)
        expect(
          await jsonBody<{ error: string; blockedByNumbers: number[] }>(res),
        ).toEqual({
          error: `Task is blocked by incomplete tasks: #${String(blocker.number)}`,
          blockedByNumbers: [blocker.number],
        })
      })

      it('does not block re-setting an already-completed task to completed', async () => {
        const blocker = await createTask('Blocker')
        const task = await createTask('Blocked')
        await setStatus(task.id, 'completed')
        await setBlockedBy(task.id, [blocker.id])

        const res = await setStatus(task.id, 'completed')

        expect(res.status).toBe(200)
        const body = await jsonBody<TaskResponse>(res)
        expect(body.status).toBe('completed')
      })

      it('allows reopening a task regardless of its blockers', async () => {
        const blocker = await createTask('Blocker')
        const task = await createTask('Blocked')
        await setBlockedBy(task.id, [blocker.id])

        const res = await setStatus(task.id, 'todo')

        expect(res.status).toBe(200)
        const body = await jsonBody<TaskResponse>(res)
        expect(body.status).toBe('todo')
      })
    })
  })
})
