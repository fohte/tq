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

    it('keeps the labels in the response', async () => {
      await createLabel('urgent')
      const created = await createTask('Task', { labels: ['urgent'] })

      const res = await setStatus(created.id, 'in_progress')

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

      await setStatus(task.id, 'in_progress')

      expect(await fetchTaskEvents(task.id)).toEqual([
        {
          type: 'status_changed',
          fromStatus: 'todo',
          toStatus: 'in_progress',
          toStatusReason: null,
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
      await setStatus(task.id, 'in_progress')

      await setStatus(task.id, 'in_progress')

      expect(await fetchTaskEvents(task.id)).toEqual([
        {
          type: 'status_changed',
          fromStatus: 'todo',
          toStatus: 'in_progress',
          toStatusReason: null,
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

      await setStatus(task.id, 'in_progress', {
        'X-Author': 'llm:claude-opus-5',
      })

      expect(await fetchTaskEvents(task.id)).toEqual([
        {
          type: 'status_changed',
          fromStatus: 'todo',
          toStatus: 'in_progress',
          toStatusReason: null,
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

    it('rejects a non-null statusReason on an in_progress task', async () => {
      const task = await createTask('Task')

      await expect(
        db
          .update(tasks)
          .set({ status: 'in_progress', statusReason: 'duplicate' })
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
      it('creates a task_relations row, surfaced via duplicateOfNumber/duplicateOfTask', async () => {
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

        const detailRes = await app.request(`/api/tasks/${task.id}`)
        const detailBody = await jsonBody<TaskResponse>(detailRes)
        expect(detailBody.duplicateOfNumber).toBe(target.number)
        assertDefined(detailBody.duplicateOfTask)
        expect(detailBody.duplicateOfTask.id).toBe(target.id)

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
