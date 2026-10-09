import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import {
  taskChecklistItems,
  taskChecklists,
  taskGithubLinks,
  taskRelations,
  tasks,
} from '#db/schema'
import {
  mockGithubIssueResponse,
  mockGithubPullResponse,
  upsertGithubToken,
} from '#integrations/github/testing'
import {
  createLabel,
  createRecurringTask,
  createTask,
  fetchTaskEvents,
  TaskListItemResponse,
  TaskResponse,
  TEST_UUID,
  withoutLinkSync,
} from '#routes/tasks/testing'
import { assertDefined, jsonBody, setupTestDb } from '#testing'

setupTestDb()

afterEach(() => {
  vi.restoreAllMocks()
})

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

    it('accepts a task number for parentId', async () => {
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

    it('returns 409 for a self-referencing parent given as a task number', async () => {
      const task = await createTask('Task')

      const res = await app.request(`/api/tasks/${task.id}/parent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: String(task.number) }),
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

    it('returns 409 for a circular reference given as a task number', async () => {
      const grandparent = await createTask('Grandparent')
      const parent = await createTask('Parent', {
        parentId: grandparent.id,
      })
      const child = await createTask('Child', { parentId: parent.id })

      const res = await app.request(`/api/tasks/${grandparent.id}/parent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: String(child.number) }),
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
    it('does not generate a next task', async () => {
      const task = await createRecurringTask(
        'Daily task',
        { type: 'daily', interval: 1 },
        { dueDate: '2026-03-22' },
      )

      const res = await app.request(`/api/tasks/${task.id}/complete`, {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body).toEqual({
        ...withoutLinkSync(task),
        status: 'completed',
        statusReason: 'completed',
        updatedAt: body.updatedAt,
      })

      const rows = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.title, 'Daily task'))
      expect(rows).toEqual([{ id: task.id }])
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
      const body = await jsonBody<TaskResponse>(res)
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

      it('resolves a task number before recording the duplicate target', async () => {
        const target = await createTask('Target')
        const task = await createTask('Duplicate me')

        const res = await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            statusReason: 'duplicate',
            duplicateOfTaskId: target.number,
          }),
        })

        const getActual = async () => ({
          status: res.status,
          relations: await fetchDuplicateOfRelations(task.id),
        })

        expect(await getActual()).toEqual({
          status: 200,
          relations: [
            {
              sourceTaskId: task.id,
              targetTaskId: target.id,
              type: 'duplicate_of',
            },
          ],
        })
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

        const listRes = await app.request(
          '/api/tasks?context=all&status=all&limit=unlimited',
        )
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

      it('returns 400 when duplicateOfTaskId is its own task number', async () => {
        const task = await createTask('Duplicate me')

        const res = await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            statusReason: 'duplicate',
            duplicateOfTaskId: task.number,
          }),
        })

        const getActual = async () => ({
          status: res.status,
          relations: await fetchDuplicateOfRelations(task.id),
        })

        expect(await getActual()).toEqual({ status: 400, relations: [] })
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

      it('returns the same not-found response for a missing UUID or task number', async () => {
        const task = await createTask('Duplicate me')
        const results = await Promise.all(
          [TEST_UUID, 2147483647].map(async (duplicateOfTaskId) => {
            const res = await app.request(`/api/tasks/${task.id}/complete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                statusReason: 'duplicate',
                duplicateOfTaskId,
              }),
            })

            return {
              status: res.status,
              body: await jsonBody<{ error: string }>(res),
            }
          }),
        )

        const expected = [
          { status: 404, body: { error: 'Duplicate target task not found' } },
          { status: 404, body: { error: 'Duplicate target task not found' } },
        ]

        expect(results).toEqual(expected)
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

      it('resolves a task number before recording the duplicate target', async () => {
        const target = await createTask('Target')
        const task = await createTask('Duplicate me')

        const res = await app.request(`/api/tasks/${task.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'completed',
            statusReason: 'duplicate',
            duplicateOfTaskId: String(target.number),
          }),
        })

        const getActual = async () => ({
          status: res.status,
          relations: await fetchDuplicateOfRelations(task.id),
        })

        expect(await getActual()).toEqual({
          status: 200,
          relations: [
            {
              sourceTaskId: task.id,
              targetTaskId: target.id,
              type: 'duplicate_of',
            },
          ],
        })
      })

      it('returns 400 when duplicateOfTaskId is its own task number', async () => {
        const task = await createTask('Duplicate me')

        const res = await app.request(`/api/tasks/${task.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'completed',
            statusReason: 'duplicate',
            duplicateOfTaskId: String(task.number),
          }),
        })

        const getActual = async () => ({
          status: res.status,
          relations: await fetchDuplicateOfRelations(task.id),
        })

        expect(await getActual()).toEqual({ status: 400, relations: [] })
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

        const listRes = await app.request(
          '/api/tasks?context=all&status=all&limit=unlimited',
        )
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

        const listRes = await app.request(
          '/api/tasks?context=all&status=all&limit=unlimited',
        )
        const listBody = await jsonBody<TaskListItemResponse[]>(listRes)
        const listItem = listBody.find((t) => t.id === task.id)
        assertDefined(listItem)
        expect(listItem.duplicateOfNumber).toBeNull()
      })
    })

    describe('task_relations_no_self_relation constraint', () => {
      // Both handlers resolve UUIDs and task numbers to UUIDs and reject a
      // matching target before writing the relation, so insert directly to
      // guard this schema invariant, as with `task_links_no_self_link`.
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

  describe('unchecked completion criteria guard', () => {
    async function createChecklist(taskId: string, name: string) {
      const checklist = (
        await db
          .insert(taskChecklists)
          .values({ taskId, name })
          .returning({ id: taskChecklists.id })
      )[0]
      assertDefined(checklist)
      return checklist.id
    }

    async function createChecklistItem(
      checklistId: string,
      content: string,
      opts: { parentItemId?: string; checked?: boolean } = {},
    ) {
      const item = (
        await db
          .insert(taskChecklistItems)
          .values({
            checklistId,
            content,
            ...(opts.parentItemId === undefined
              ? {}
              : { parentItemId: opts.parentItemId }),
            checkedAt: opts.checked === true ? new Date() : null,
          })
          .returning({ id: taskChecklistItems.id })
      )[0]
      assertDefined(item)
      return item.id
    }

    async function completeTask(
      taskId: string,
      method: 'PATCH' | 'POST',
      statusReason?: 'completed' | 'not_planned' | 'duplicate',
      author = 'llm:completion-checker',
    ) {
      const body =
        method === 'PATCH'
          ? {
              status: 'completed',
              ...(statusReason === undefined ? {} : { statusReason }),
            }
          : statusReason === undefined
            ? {}
            : { statusReason }
      const route =
        method === 'PATCH'
          ? `/api/tasks/${taskId}/status`
          : `/api/tasks/${taskId}/complete`
      return app.request(route, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Author': author,
        },
        body: JSON.stringify(body),
      })
    }

    it('returns unchecked criteria for LLM completion through both routes', async () => {
      const description = [
        '- [ ] Verify the result',
        '* [ ] Confirm the handoff',
        '',
        '```md',
        '- [ ] This example is not a criterion',
        '```',
      ].join('\n')
      const attempts = [
        { method: 'PATCH' as const, title: 'Status route task' },
        { method: 'POST' as const, title: 'Complete route task' },
      ]
      const actual = []
      for (const attempt of attempts) {
        const task = await createTask(attempt.title, { description })
        const res = await completeTask(task.id, attempt.method)
        const body = await jsonBody<{
          error: string
          uncheckedCompletionCriteria: string[]
        }>(res)
        const [storedTask] = await db
          .select({ status: tasks.status, statusReason: tasks.statusReason })
          .from(tasks)
          .where(eq(tasks.id, task.id))
        actual.push({
          method: attempt.method,
          status: res.status,
          body,
          task: storedTask,
        })
      }

      const uncheckedCompletionCriteria = [
        '- [ ] Verify the result',
        '- [ ] Confirm the handoff',
      ]
      expect(actual).toEqual([
        {
          method: 'PATCH',
          status: 400,
          body: {
            error: [
              'Unchecked completion criteria:',
              ...uncheckedCompletionCriteria,
              'Check off each verified item before completing the task. If you decide not to do the work, close it with statusReason "not_planned".',
            ].join('\n'),
            uncheckedCompletionCriteria,
          },
          task: { status: 'todo', statusReason: null },
        },
        {
          method: 'POST',
          status: 400,
          body: {
            error: [
              'Unchecked completion criteria:',
              ...uncheckedCompletionCriteria,
              'Check off each verified item before completing the task. If you decide not to do the work, close it with statusReason "not_planned".',
            ].join('\n'),
            uncheckedCompletionCriteria,
          },
          task: { status: 'todo', statusReason: null },
        },
      ])
    })

    it('rejects LLM completion when unchecked checklist leaf items remain', async () => {
      const methods = ['PATCH', 'POST'] as const
      const actual = []
      for (const method of methods) {
        const task = await createTask(`${method} checklist task`)
        const checklistId = await createChecklist(task.id, 'Release readiness')
        const parentItemId = await createChecklistItem(
          checklistId,
          'Release checks',
        )
        const uncheckedItemId = await createChecklistItem(
          checklistId,
          'Verify deployment',
          { parentItemId },
        )
        await createChecklistItem(checklistId, 'Confirm handoff', {
          parentItemId,
          checked: true,
        })

        const res = await completeTask(task.id, method)
        const body = await jsonBody<{
          error: string
          uncheckedCompletionCriteria: string[]
          uncheckedChecklistItems: {
            id: string
            checklistName: string | null
            content: string
          }[]
        }>(res)
        const [storedTask] = await db
          .select({ status: tasks.status, statusReason: tasks.statusReason })
          .from(tasks)
          .where(eq(tasks.id, task.id))
        actual.push({
          method,
          status: res.status,
          body: {
            error: body.error,
            uncheckedCompletionCriteria: body.uncheckedCompletionCriteria,
            uncheckedChecklistItems: body.uncheckedChecklistItems.map(
              (item) => ({
                ...item,
                id: item.id === uncheckedItemId ? 'ITEM' : item.id,
              }),
            ),
          },
          task: storedTask,
        })
      }

      const checklistError = [
        'Unchecked checklist items:',
        '- Release readiness: Verify deployment',
        'Check off each verified checklist item before completing the task. If you decide not to do the work, close it with statusReason "not_planned".',
      ].join('\n')
      expect(actual).toEqual([
        {
          method: 'PATCH',
          status: 400,
          body: {
            error: checklistError,
            uncheckedCompletionCriteria: [],
            uncheckedChecklistItems: [
              {
                id: 'ITEM',
                checklistName: 'Release readiness',
                content: 'Verify deployment',
              },
            ],
          },
          task: { status: 'todo', statusReason: null },
        },
        {
          method: 'POST',
          status: 400,
          body: {
            error: checklistError,
            uncheckedCompletionCriteria: [],
            uncheckedChecklistItems: [
              {
                id: 'ITEM',
                checklistName: 'Release readiness',
                content: 'Verify deployment',
              },
            ],
          },
          task: { status: 'todo', statusReason: null },
        },
      ])
    })

    it('allows LLM completion when every checklist leaf item is checked', async () => {
      const task = await createTask('Checked checklist task')
      const checklistId = await createChecklist(task.id, 'Release readiness')
      const parentItemId = await createChecklistItem(
        checklistId,
        'Release checks',
      )
      await createChecklistItem(checklistId, 'Verify deployment', {
        parentItemId,
        checked: true,
      })
      await createChecklistItem(checklistId, 'Confirm handoff', {
        parentItemId,
        checked: true,
      })

      const res = await completeTask(task.id, 'POST')
      const [storedTask] = await db
        .select({ status: tasks.status, statusReason: tasks.statusReason })
        .from(tasks)
        .where(eq(tasks.id, task.id))

      const getActual = () => ({ status: res.status, task: storedTask })
      expect(getActual()).toEqual({
        status: 200,
        task: { status: 'completed', statusReason: 'completed' },
      })
    })

    it('returns both unchecked description criteria and checklist items', async () => {
      const task = await createTask('Combined criteria task', {
        description: '- [ ] Verify the result',
      })
      const checklistId = await createChecklist(task.id, 'Release readiness')
      const uncheckedItemId = await createChecklistItem(
        checklistId,
        'Verify deployment',
      )

      const res = await completeTask(task.id, 'POST')
      const body = await jsonBody<{
        error: string
        uncheckedCompletionCriteria: string[]
        uncheckedChecklistItems: {
          id: string
          checklistName: string | null
          content: string
        }[]
      }>(res)
      const [storedTask] = await db
        .select({ status: tasks.status, statusReason: tasks.statusReason })
        .from(tasks)
        .where(eq(tasks.id, task.id))

      const getActual = () => ({
        status: res.status,
        body: {
          error: body.error,
          uncheckedCompletionCriteria: body.uncheckedCompletionCriteria,
          uncheckedChecklistItems: body.uncheckedChecklistItems.map((item) => ({
            ...item,
            id: item.id === uncheckedItemId ? 'ITEM' : item.id,
          })),
        },
        task: storedTask,
      })
      expect(getActual()).toEqual({
        status: 400,
        body: {
          error: [
            'Unchecked completion criteria:',
            '- [ ] Verify the result',
            'Unchecked checklist items:',
            '- Release readiness: Verify deployment',
            'Check off each verified completion criterion and checklist item before completing the task. If you decide not to do the work, close it with statusReason "not_planned".',
          ].join('\n'),
          uncheckedCompletionCriteria: ['- [ ] Verify the result'],
          uncheckedChecklistItems: [
            {
              id: 'ITEM',
              checklistName: 'Release readiness',
              content: 'Verify deployment',
            },
          ],
        },
        task: { status: 'todo', statusReason: null },
      })
    })

    it('ignores checked criteria and task lists inside fenced or indented code blocks', async () => {
      const attempts = [
        {
          method: 'PATCH' as const,
          title: 'Checked criteria task',
          description: '- [x] Verify the result',
        },
        {
          method: 'POST' as const,
          title: 'Fenced code task',
          description: '```md\n- [ ] Example only\n```',
        },
        {
          method: 'PATCH' as const,
          title: 'Indented code task',
          description: '    * [ ] Example only',
        },
        {
          method: 'POST' as const,
          title: 'No description task',
          description: undefined,
        },
      ]
      const actual = []
      for (const attempt of attempts) {
        const task = await createTask(attempt.title, {
          ...(attempt.description === undefined
            ? {}
            : { description: attempt.description }),
        })
        const res = await completeTask(task.id, attempt.method)
        const [storedTask] = await db
          .select({ status: tasks.status, statusReason: tasks.statusReason })
          .from(tasks)
          .where(eq(tasks.id, task.id))
        actual.push({
          method: attempt.method,
          status: res.status,
          task: storedTask,
        })
      }

      expect(actual).toEqual([
        {
          method: 'PATCH',
          status: 200,
          task: { status: 'completed', statusReason: 'completed' },
        },
        {
          method: 'POST',
          status: 200,
          task: { status: 'completed', statusReason: 'completed' },
        },
        {
          method: 'PATCH',
          status: 200,
          task: { status: 'completed', statusReason: 'completed' },
        },
        {
          method: 'POST',
          status: 200,
          task: { status: 'completed', statusReason: 'completed' },
        },
      ])
    })

    it('allows human and non-completion reasons to close tasks with unchecked criteria', async () => {
      const attempts = [
        {
          method: 'PATCH' as const,
          title: 'Human status task',
          author: 'human',
          statusReason: undefined,
        },
        {
          method: 'POST' as const,
          title: 'Human complete task',
          author: 'human',
          statusReason: undefined,
        },
        {
          method: 'PATCH' as const,
          title: 'Not planned status task',
          author: 'llm:completion-checker',
          statusReason: 'not_planned' as const,
        },
        {
          method: 'POST' as const,
          title: 'Not planned complete task',
          author: 'llm:completion-checker',
          statusReason: 'not_planned' as const,
        },
        {
          method: 'PATCH' as const,
          title: 'Duplicate status task',
          author: 'llm:completion-checker',
          statusReason: 'duplicate' as const,
        },
        {
          method: 'POST' as const,
          title: 'Duplicate complete task',
          author: 'llm:completion-checker',
          statusReason: 'duplicate' as const,
        },
      ]
      const actual = []
      for (const attempt of attempts) {
        const task = await createTask(attempt.title, {
          description: '- [ ] Verify the result',
        })
        const checklistId = await createChecklist(task.id, 'Release readiness')
        await createChecklistItem(checklistId, 'Verify deployment')
        const res = await completeTask(
          task.id,
          attempt.method,
          attempt.statusReason,
          attempt.author,
        )
        const [storedTask] = await db
          .select({ status: tasks.status, statusReason: tasks.statusReason })
          .from(tasks)
          .where(eq(tasks.id, task.id))
        actual.push({
          method: attempt.method,
          author: attempt.author,
          statusReason: attempt.statusReason ?? 'completed',
          responseStatus: res.status,
          task: storedTask,
        })
      }

      expect(actual).toEqual(
        attempts.map((attempt) => ({
          method: attempt.method,
          author: attempt.author,
          statusReason: attempt.statusReason ?? 'completed',
          responseStatus: 200,
          task: {
            status: 'completed',
            statusReason: attempt.statusReason ?? 'completed',
          },
        })),
      )
    })

    it('rejects completion when the task description cannot be parsed', async () => {
      const task = await createTask('Unparseable criteria task', {
        description: `${'> '.repeat(5000)}x\n- [ ] Verify the result`,
      })

      const res = await completeTask(task.id, 'POST')
      const body = await jsonBody<{
        error: string
        uncheckedCompletionCriteria: string[]
      }>(res)
      const [storedTask] = await db
        .select({ status: tasks.status, statusReason: tasks.statusReason })
        .from(tasks)
        .where(eq(tasks.id, task.id))

      const getActual = () => ({ status: res.status, body, task: storedTask })
      expect(getActual()).toEqual({
        status: 400,
        body: {
          error: [
            'Could not inspect completion criteria because the description could not be parsed as Markdown.',
            'Simplify the description and verify its criteria before completing the task, or close it with statusReason "not_planned".',
          ].join('\n'),
          uncheckedCompletionCriteria: [],
        },
        task: { status: 'todo', statusReason: null },
      })
    }, 15_000)

    it('keeps completed PATCH retries idempotent and checks a changed completion reason', async () => {
      const retryTask = await createTask('Completed retry task', {
        description: '- [ ] Verify the result',
      })
      await completeTask(retryTask.id, 'PATCH', undefined, 'human')
      const retryRes = await completeTask(retryTask.id, 'PATCH')
      const [retryTaskState] = await db
        .select({ status: tasks.status, statusReason: tasks.statusReason })
        .from(tasks)
        .where(eq(tasks.id, retryTask.id))

      const notPlannedTask = await createTask('Not planned task', {
        description: '- [ ] Verify the result',
      })
      const notPlannedRes = await completeTask(
        notPlannedTask.id,
        'PATCH',
        'not_planned',
      )
      const completedReasonRes = await completeTask(
        notPlannedTask.id,
        'PATCH',
        'completed',
      )
      const completedReasonBody = await jsonBody<{
        error: string
        uncheckedCompletionCriteria: string[]
      }>(completedReasonRes)
      const [notPlannedTaskState] = await db
        .select({ status: tasks.status, statusReason: tasks.statusReason })
        .from(tasks)
        .where(eq(tasks.id, notPlannedTask.id))

      const getActual = () => ({
        retryStatus: retryRes.status,
        retryTaskState,
        notPlannedStatus: notPlannedRes.status,
        completedReasonStatus: completedReasonRes.status,
        completedReasonBody,
        notPlannedTaskState,
      })
      expect(getActual()).toEqual({
        retryStatus: 200,
        retryTaskState: { status: 'completed', statusReason: 'completed' },
        notPlannedStatus: 200,
        completedReasonStatus: 400,
        completedReasonBody: {
          error: [
            'Unchecked completion criteria:',
            '- [ ] Verify the result',
            'Check off each verified item before completing the task. If you decide not to do the work, close it with statusReason "not_planned".',
          ].join('\n'),
          uncheckedCompletionCriteria: ['- [ ] Verify the result'],
        },
        notPlannedTaskState: {
          status: 'completed',
          statusReason: 'not_planned',
        },
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
      it('blocks completion with open GitHub issues and ignores merged pull requests', async () => {
        const internalBlocker = await createTask('Internal blocker')
        const task = await createTask('Blocked by GitHub')
        const issueUrl =
          'https://github.com/example-owner/example-repo/issues/17'
        const pullUrl = 'https://github.com/example-owner/example-repo/pull/18'
        await upsertGithubToken('valid-token')
        mockGithubIssueResponse({
          title: 'Open issue',
          html_url: issueUrl,
        })
        mockGithubIssueResponse({
          title: 'Merged pull request',
          html_url: pullUrl,
          state: 'closed',
          pull_request: {},
        })
        mockGithubPullResponse(true)
        const patchRes = await setBlockedBy(task.id, [
          internalBlocker.id,
          issueUrl,
          pullUrl,
        ])
        const blockedRes = await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
        })
        const githubBlockers = await db
          .select({
            id: taskGithubLinks.id,
            owner: taskGithubLinks.owner,
            repo: taskGithubLinks.repo,
            number: taskGithubLinks.number,
            state: taskGithubLinks.state,
          })
          .from(taskGithubLinks)
          .where(eq(taskGithubLinks.taskId, task.id))
          .orderBy(taskGithubLinks.number)
        const issueLink = githubBlockers.find(({ number }) => number === 17)
        assertDefined(issueLink)
        await db
          .update(taskGithubLinks)
          .set({ state: 'closed', stateReason: 'not_planned' })
          .where(eq(taskGithubLinks.id, issueLink.id))
        const internalBlockerRes = await app.request(
          `/api/tasks/${internalBlocker.id}/complete`,
          { method: 'POST' },
        )
        const resolvedRes = await app.request(
          `/api/tasks/${task.id}/complete`,
          { method: 'POST' },
        )
        const resolvedBody = await jsonBody<TaskResponse>(resolvedRes)
        const blockedBody = await jsonBody<{
          error: string
          blockedByNumbers: number[]
          blockedByGithubRefs: {
            owner: string
            repo: string
            number: number
            url: string
          }[]
        }>(blockedRes)

        const getActual = () => ({
          patchStatus: patchRes.status,
          blockedStatus: blockedRes.status,
          blockedBody,
          githubBlockerStates: githubBlockers.map(({ number, state }) => ({
            number,
            state,
          })),
          resolvedStatus: resolvedRes.status,
          internalBlockerStatus: internalBlockerRes.status,
          resolvedTaskStatus: resolvedBody.status,
        })
        expect(getActual()).toEqual({
          patchStatus: 200,
          blockedStatus: 409,
          blockedBody: {
            error: `Task is blocked by unresolved blockers: #${String(internalBlocker.number)}, example-owner/example-repo#17`,
            blockedByNumbers: [internalBlocker.number],
            blockedByGithubRefs: [
              {
                owner: 'example-owner',
                repo: 'example-repo',
                number: 17,
                url: issueUrl,
              },
            ],
          },
          githubBlockerStates: [
            { number: 17, state: 'open' },
            { number: 18, state: 'merged' },
          ],
          resolvedStatus: 200,
          internalBlockerStatus: 200,
          resolvedTaskStatus: 'completed',
        })
      })

      it('returns 409 with all unresolved blockers when a blocker is incomplete', async () => {
        const blocker = await createTask('Blocker')
        const task = await createTask('Blocked')
        await setBlockedBy(task.id, [blocker.id])

        const res = await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
        })

        const body = await jsonBody<{
          error: string
          blockedByNumbers: number[]
          blockedByGithubRefs: {
            owner: string
            repo: string
            number: number
            url: string
          }[]
        }>(res)
        const [dbTask] = await db
          .select({ status: tasks.status })
          .from(tasks)
          .where(eq(tasks.id, task.id))
        assertDefined(dbTask)

        const getActual = () => ({
          status: res.status,
          body,
          taskStatus: dbTask.status,
        })
        expect(getActual()).toEqual({
          status: 409,
          body: {
            error: `Task is blocked by unresolved blockers: #${String(blocker.number)}`,
            blockedByNumbers: [blocker.number],
            blockedByGithubRefs: [],
          },
          taskStatus: 'todo',
        })
      })

      it('lists every incomplete blocker, ordered by number', async () => {
        const blockerA = await createTask('Blocker A')
        const blockerB = await createTask('Blocker B')
        const task = await createTask('Blocked')
        await setBlockedBy(task.id, [blockerB.id, blockerA.id])

        const res = await app.request(`/api/tasks/${task.id}/complete`, {
          method: 'POST',
        })

        const body = await jsonBody<{
          error: string
          blockedByNumbers: number[]
          blockedByGithubRefs: {
            owner: string
            repo: string
            number: number
            url: string
          }[]
        }>(res)
        const getActual = () => ({ status: res.status, body })
        expect(getActual()).toEqual({
          status: 409,
          body: {
            error: `Task is blocked by unresolved blockers: #${String(blockerA.number)}, #${String(blockerB.number)}`,
            blockedByNumbers: [blockerA.number, blockerB.number],
            blockedByGithubRefs: [],
          },
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
      it('returns 409 with all unresolved blockers when closing with an incomplete blocker', async () => {
        const blocker = await createTask('Blocker')
        const task = await createTask('Blocked')
        await setBlockedBy(task.id, [blocker.id])

        const res = await setStatus(task.id, 'completed')

        const body = await jsonBody<{
          error: string
          blockedByNumbers: number[]
          blockedByGithubRefs: {
            owner: string
            repo: string
            number: number
            url: string
          }[]
        }>(res)
        const getActual = () => ({ status: res.status, body })
        expect(getActual()).toEqual({
          status: 409,
          body: {
            error: `Task is blocked by unresolved blockers: #${String(blocker.number)}`,
            blockedByNumbers: [blocker.number],
            blockedByGithubRefs: [],
          },
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
