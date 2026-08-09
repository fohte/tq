import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { tasks } from '#db/schema'
import {
  createComment,
  createLabel,
  createPage,
  createRecurringTask,
  createTask,
  TaskListItemResponse,
  TaskResponse,
  TEST_UUID,
  TimeBlockResponse,
  withoutRecurrenceRule,
} from '#routes/tasks/testing'
import {
  assertDefined,
  jsonBody,
  patchSchedulingSettings,
  setupTestDb,
} from '#testing'

setupTestDb()

afterEach(() => {
  vi.useRealTimers()
})

function setStatus(taskId: string, status: string) {
  return app.request(`/api/tasks/${taskId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
}

function setProjectId(taskId: string, projectId: string) {
  return app.request(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  })
}

async function createProject(title: string) {
  const res = await app.request('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  expect(res.status).toBe(201)
  return jsonBody<{ id: string }>(res)
}

function normalizeTimeBlock(block: TimeBlockResponse) {
  return {
    ...block,
    id: 'ID',
    taskId: 'TASK',
    createdAt: 'TIMESTAMP',
    updatedAt: 'TIMESTAMP',
  }
}

// Generic (rather than `TaskResponse`-typed) so it also accepts the
// zod-inferred return type of `createTask`/`createTask`-derived PATCH
// responses, whose optional fields are typed as `T | undefined` and would
// otherwise conflict with `TaskResponse`'s plain optional fields under
// `exactOptionalPropertyTypes`.
function normalizeTask<
  T extends {
    id: string
    number: number
    createdAt: string
    updatedAt: string
  },
>(task: T) {
  return {
    ...task,
    id: 'ID',
    number: -1,
    createdAt: 'TIMESTAMP',
    updatedAt: 'TIMESTAMP',
  }
}

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

    it('falls back to the configured default context when unspecified', async () => {
      await patchSchedulingSettings({ defaultContext: 'work' })

      const res = await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Buy groceries' }),
      })

      expect(res.status).toBe(201)
      const body = await jsonBody<TaskResponse>(res)
      expect(normalizeTask(body)).toEqual({
        id: 'ID',
        number: -1,
        title: 'Buy groceries',
        description: null,
        status: 'todo',
        context: 'work',
        labels: [],
        startDate: null,
        dueDate: null,
        estimatedMinutes: null,
        parentId: null,
        projectId: null,
        recurrenceRuleId: null,
        recurrenceRule: null,
        githubLink: null,
        createdAt: 'TIMESTAMP',
        updatedAt: 'TIMESTAMP',
      })
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

    it('creates any label names that do not exist yet and attaches all of them', async () => {
      await createLabel('foo')

      const res = await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Labeled task',
          labels: ['foo', 'new-label'],
        }),
      })
      expect(res.status).toBe(201)
      const body = await jsonBody<TaskResponse>(res)
      const sortedLabels = body.labels.toSorted()
      expect(sortedLabels).toEqual(['foo', 'new-label'])
    })

    it('returns an empty labels array when no labels are given', async () => {
      const res = await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Unlabeled task' }),
      })

      expect(res.status).toBe(201)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.labels).toEqual([])
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
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(2)
    })

    it('filters by parentId', async () => {
      const parent = await createTask('Parent')
      await createTask('Child 1', { parentId: parent.id })
      await createTask('Child 2', { parentId: parent.id })
      await createTask('Orphan')

      const res = await app.request(`/api/tasks?parentId=${parent.id}`)

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
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
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].title).toBe('Task B')
    })

    it('includes each task labels in the response', async () => {
      await createLabel('urgent')
      await createLabel('bug')
      const taskA = await createTask('Task A', { labels: ['urgent', 'bug'] })
      const taskB = await createTask('Task B', { labels: ['urgent'] })
      const taskC = await createTask('Task C')

      const res = await app.request('/api/tasks')
      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      const byId = new Map(body.map((t) => [t.id, t.labels.toSorted()]))
      const labelsByTask = [taskA, taskB, taskC].map((t) => byId.get(t.id))

      expect(labelsByTask).toEqual([['bug', 'urgent'], ['urgent'], []])
    })

    it('sorts by createdAt ascending by default', async () => {
      const taskA = await createTask('Task A')
      const taskB = await createTask('Task B')

      // `createdAt` defaults to Postgres's `now()`, which is frozen at this
      // test's transaction start (see setupTestDb), so both creates above
      // share the exact same timestamp and `ORDER BY created_at` has no real
      // tiebreaker, making its result an unspecified tie-break rather than a
      // genuine test of createdAt ordering. Force distinct `createdAt`
      // values directly so the assertion exercises the real sort key
      // deterministically.
      await db
        .update(tasks)
        .set({ createdAt: new Date('2020-01-01T00:00:00.000Z') })
        .where(eq(tasks.id, taskA.id))
      await db
        .update(tasks)
        .set({ createdAt: new Date('2020-01-02T00:00:00.000Z') })
        .where(eq(tasks.id, taskB.id))

      const res = await app.request('/api/tasks')

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body.map(normalizeTask)).toEqual([
        {
          ...normalizeTask(withoutRecurrenceRule(taskA)),
          parentNumber: null,
          childCompletionCount: { completed: 0, total: 0 },
        },
        {
          ...normalizeTask(withoutRecurrenceRule(taskB)),
          parentNumber: null,
          childCompletionCount: { completed: 0, total: 0 },
        },
      ])
    })

    it('sorts by updatedAt descending when sortBy=updated', async () => {
      const taskA = await createTask('Task A')
      const taskB = await createTask('Task B')
      const taskC = await createTask('Task C')

      // `createdAt`/`updatedAt` both default to Postgres's `now()`, which is
      // frozen at this test's transaction start (see setupTestDb), so all
      // three creates above share the exact same timestamp. Give each task a
      // distinct `updatedAt` via a PATCH under a fake clock (PATCH sets
      // `updatedAt: new Date()` in application code, unlike the DB-side
      // default) so `ORDER BY updated_at DESC` has no ties to break
      // arbitrarily — three distinct values also mean the resulting order
      // ([B, C, A]) can't coincide with plain creation order ([A, B, C]) or
      // its reverse.
      const patchWithFakeTime = async (
        task: { id: string; title: string },
        time: string,
      ) => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date(time))
        const res = await app.request(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: `${task.title} (updated)` }),
        })
        vi.useRealTimers()
        expect(res.status).toBe(200)
        return jsonBody<TaskResponse>(res)
      }

      const patchedTaskA = await patchWithFakeTime(
        taskA,
        '2030-01-01T00:00:00.000Z',
      )
      const patchedTaskC = await patchWithFakeTime(
        taskC,
        '2030-01-02T00:00:00.000Z',
      )
      const patchedTaskB = await patchWithFakeTime(
        taskB,
        '2030-01-03T00:00:00.000Z',
      )

      const res = await app.request('/api/tasks?sortBy=updated')

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body.map(normalizeTask)).toEqual([
        {
          ...normalizeTask(withoutRecurrenceRule(patchedTaskB)),
          parentNumber: null,
          childCompletionCount: { completed: 0, total: 0 },
        },
        {
          ...normalizeTask(withoutRecurrenceRule(patchedTaskC)),
          parentNumber: null,
          childCompletionCount: { completed: 0, total: 0 },
        },
        {
          ...normalizeTask(withoutRecurrenceRule(patchedTaskA)),
          parentNumber: null,
          childCompletionCount: { completed: 0, total: 0 },
        },
      ])
    })
  })

  describe('GET /api/tasks with extended predicates', () => {
    it('filters by multiple status values', async () => {
      const todoTask = await createTask('Todo task')
      const inProgressTask = await createTask('In progress task')
      const completedTask = await createTask('Completed task')
      await setStatus(inProgressTask.id, 'in_progress')
      await setStatus(completedTask.id, 'completed')

      const res = await app.request('/api/tasks?status=todo&status=in_progress')

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body.map((t) => t.id).toSorted()).toEqual(
        [todoTask.id, inProgressTask.id].toSorted(),
      )
    })

    it('filters by free text via q', async () => {
      await createTask('Deploy to production')
      await createTask('Buy groceries')

      const res = await app.request(
        '/api/tasks?q=' + encodeURIComponent('deploy'),
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].title).toBe('Deploy to production')
    })

    it('lets a parsed q prefix win over the explicit status param', async () => {
      await createTask('Todo task')
      const completedTask = await createTask('Completed task')
      await setStatus(completedTask.id, 'completed')

      const res = await app.request(
        '/api/tasks?status=todo&q=' + encodeURIComponent('is:completed'),
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].id).toBe(completedTask.id)
    })

    it('filters by label', async () => {
      await createLabel('urgent')
      const labeledTask = await createTask('Labeled', { labels: ['urgent'] })
      await createTask('Unlabeled')

      const res = await app.request('/api/tasks?label=urgent')

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].id).toBe(labeledTask.id)
    })

    it('filters by hasEstimate', async () => {
      const withEstimate = await createTask('With estimate', {
        estimatedMinutes: 30,
      })
      await createTask('Without estimate')

      const res = await app.request('/api/tasks?hasEstimate=true')

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].id).toBe(withEstimate.id)
    })

    it('filters by hasDue', async () => {
      await createTask('With due date', { dueDate: '2026-03-25' })
      const withoutDue = await createTask('Without due date')

      const res = await app.request('/api/tasks?hasDue=false')

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].id).toBe(withoutDue.id)
    })

    it('filters by context: prefix in q parameter', async () => {
      await createTask('Work task', { context: 'work' })
      await createTask('Personal task')

      const res = await app.request(
        '/api/tasks?q=' + encodeURIComponent('context:work'),
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].title).toBe('Work task')
    })

    it('filters by has:pages prefix in q parameter', async () => {
      const task = await createTask('Has pages')
      await createTask('No pages')
      await createPage(task.id, 'Page', 'content')

      const res = await app.request(
        '/api/tasks?q=' + encodeURIComponent('has:pages'),
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].title).toBe('Has pages')
    })

    it('filters by has:comments prefix in q parameter', async () => {
      const task = await createTask('Has comments')
      await createTask('No comments')
      await createComment(task.id, 'A comment')

      const res = await app.request(
        '/api/tasks?q=' + encodeURIComponent('has:comments'),
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].title).toBe('Has comments')
    })

    it('filters by parent: prefix in q parameter', async () => {
      const parent = await createTask('Parent')
      await createTask('Child', { parentId: parent.id })
      await createTask('Orphan')

      const res = await app.request(
        '/api/tasks?q=' + encodeURIComponent(`parent:${parent.id}`),
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].title).toBe('Child')
    })

    it('returns tasks belonging to the project', async () => {
      const project = await createProject('My project')
      const task = await createTask('Task in project')
      await setProjectId(task.id, project.id)
      await createTask('Task without project')

      const res = await app.request(`/api/tasks?projectId=${project.id}`)

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].id).toBe(task.id)
    })

    it('includes each task labels in the response', async () => {
      await createLabel('urgent')
      const project = await createProject('My project')
      const task = await createTask('Labeled task', { labels: ['urgent'] })
      await setProjectId(task.id, project.id)

      const res = await app.request(`/api/tasks?projectId=${project.id}`)

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].labels).toEqual(['urgent'])
    })

    it('filters descendants of a task via descendantOf, excluding the root itself', async () => {
      const root = await createTask('Root')
      const child = await createTask('Child', { parentId: root.id })
      const grandchild = await createTask('Grandchild', { parentId: child.id })
      await createTask('Unrelated')

      const res = await app.request(`/api/tasks?descendantOf=${root.id}`)

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body.map((t) => t.id).toSorted()).toEqual(
        [child.id, grandchild.id].toSorted(),
      )
    })

    it('limits the returned tasks', async () => {
      await createTask('Task 1')
      await createTask('Task 2')
      await createTask('Task 3')

      const res = await app.request('/api/tasks?limit=1')

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(1)
    })

    it('combines descendantOf, includeAncestors, a status filter, and limit', async () => {
      const root = await createTask('Root')
      const child = await createTask('Child', { parentId: root.id })
      const grandchild1 = await createTask('Grandchild 1', {
        parentId: child.id,
      })
      const grandchild2 = await createTask('Grandchild 2', {
        parentId: child.id,
      })
      await setStatus(child.id, 'completed')

      // `createdAt` is frozen to the transaction start (see setupTestDb), so
      // both grandchildren would otherwise tie on the default sort key and
      // make which one `limit=1` keeps nondeterministic.
      await db
        .update(tasks)
        .set({ createdAt: new Date('2020-01-01T00:00:00.000Z') })
        .where(eq(tasks.id, grandchild1.id))
      await db
        .update(tasks)
        .set({ createdAt: new Date('2020-01-02T00:00:00.000Z') })
        .where(eq(tasks.id, grandchild2.id))

      const res = await app.request(
        `/api/tasks?descendantOf=${root.id}&status=todo&includeAncestors=true&limit=1`,
      )

      expect(res.status).toBe(200)
      const body =
        await jsonBody<
          Array<TaskListItemResponse & { ancestorOnly?: boolean }>
        >(res)

      // limit constrains only the predicate-matching set (grandchild1, the
      // earlier-created of the two todo grandchildren); its full ancestor
      // chain (child, root) is added on top, flagged ancestorOnly, and not
      // counted against the limit. grandchild2 never appears.
      expect(
        body.map((t) => [t.id, t.ancestorOnly ?? false]).toSorted(),
      ).toEqual(
        [
          [grandchild1.id, false],
          [child.id, true],
          [root.id, true],
        ].toSorted(),
      )
    })

    it('always computes childCompletionCount over all children regardless of the active filter', async () => {
      const parent = await createTask('Parent')
      await createTask('Child 1', { parentId: parent.id })
      const child2 = await createTask('Child 2', { parentId: parent.id })
      await setStatus(child2.id, 'completed')

      const res = await app.request('/api/tasks?status=todo')

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      const parentBody = body.find((t) => t.id === parent.id)
      assertDefined(parentBody)
      expect(parentBody.childCompletionCount).toEqual({
        completed: 1,
        total: 2,
      })
    })

    it('sorts by due date ascending when sortBy=due', async () => {
      const taskA = await createTask('Task A', { dueDate: '2026-03-25' })
      const taskB = await createTask('Task B', { dueDate: '2026-03-20' })
      const taskC = await createTask('Task C', { dueDate: '2026-03-22' })

      const res = await app.request('/api/tasks?sortBy=due')

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body.map((t) => t.id)).toEqual([taskB.id, taskC.id, taskA.id])
    })

    it('sorts by estimate ascending when sortBy=estimate', async () => {
      const taskA = await createTask('Task A', { estimatedMinutes: 90 })
      const taskB = await createTask('Task B', { estimatedMinutes: 15 })
      const taskC = await createTask('Task C', { estimatedMinutes: 45 })

      const res = await app.request('/api/tasks?sortBy=estimate')

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body.map((t) => t.id)).toEqual([taskB.id, taskC.id, taskA.id])
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

    it('returns empty labels array when task has no labels', async () => {
      const created = await createTask('No labels')

      const res = await app.request(`/api/tasks/${created.id}`)

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body).toEqual({
        ...created,
        titleAuthor: { kind: 'human', agent: null },
        descriptionAuthor: { kind: 'human', agent: null },
        childCompletionCount: { total: 0, completed: 0 },
        pages: [],
        timeBlocks: [],
        links: { outgoing: [], incoming: [] },
        labels: [],
      })
    })

    it('includes labels for a task with labels', async () => {
      await createLabel('bug')
      await createLabel('urgent')
      const created = await createTask('Labeled', {
        labels: ['bug', 'urgent'],
      })

      const res = await app.request(`/api/tasks/${created.id}`)

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      body.labels.sort()
      expect(body).toEqual({
        ...created,
        titleAuthor: { kind: 'human', agent: null },
        descriptionAuthor: { kind: 'human', agent: null },
        childCompletionCount: { total: 0, completed: 0 },
        pages: [],
        timeBlocks: [],
        links: { outgoing: [], incoming: [] },
        labels: ['bug', 'urgent'],
      })
    })

    it('returns 404 for non-existent ID', async () => {
      const res = await app.request(`/api/tasks/${TEST_UUID}`)

      expect(res.status).toBe(404)
    })

    it('includes labels in the response', async () => {
      await createLabel('urgent')
      await createLabel('bug')
      const created = await createTask('Labeled task', {
        labels: ['urgent', 'bug'],
      })

      const res = await app.request(`/api/tasks/${created.id}`)

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.labels.toSorted()).toEqual(['bug', 'urgent'])
    })

    it('accepts the task number in place of the UUID', async () => {
      const created = await createTask('Numbered task')

      const res = await app.request(`/api/tasks/${String(created.number)}`)

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.id).toBe(created.id)
    })

    it('returns 404 for a non-existent number', async () => {
      const res = await app.request('/api/tasks/999999999')

      expect(res.status).toBe(404)
    })

    it('returns 404 for a number beyond the int4 range', async () => {
      const res = await app.request('/api/tasks/99999999999')

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
      await app.request('/api/schedule/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          startTime: '2026-03-22T09:00:00.000Z',
          endTime: '2026-03-22T10:00:00.000Z',
        }),
      })

      const res = await app.request(`/api/tasks/${task.id}`)

      expect(res.status).toBe(200)
      const body = await jsonBody<
        TaskResponse & { timeBlocks: TimeBlockResponse[] }
      >(res)
      expect(body.timeBlocks.map(normalizeTimeBlock)).toEqual([
        {
          id: 'ID',
          taskId: 'TASK',
          startTime: '2026-03-22T09:00:00.000Z',
          endTime: '2026-03-22T10:00:00.000Z',
          isAutoScheduled: false,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
      ])
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

    it('tracks title and description authors independently', async () => {
      const created = await createTask('Original title', {
        description: 'Original description',
      })

      await app.request(`/api/tasks/${created.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Author': 'llm:claude-opus-5',
        },
        body: JSON.stringify({ title: 'Updated title' }),
      })

      const res = await app.request(`/api/tasks/${created.id}`)

      expect(res.status).toBe(200)
      const body = await jsonBody<
        TaskResponse & {
          titleAuthor: { kind: string; agent: string | null } | null
          descriptionAuthor: { kind: string; agent: string | null } | null
        }
      >(res)
      expect(body.titleAuthor).toEqual({ kind: 'llm', agent: 'claude-opus-5' })
      expect(body.descriptionAuthor).toEqual({ kind: 'human', agent: null })
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

    it('keeps the existing labels unchanged', async () => {
      await createLabel('urgent')
      const created = await createTask('Task', { labels: ['urgent'] })

      const res = await app.request(`/api/tasks/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated' }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body.labels).toEqual(['urgent'])
    })

    it('replaces the labels when given', async () => {
      const created = await createTask('Task', { labels: ['urgent'] })

      const res = await app.request(`/api/tasks/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels: ['bug'] }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body).toEqual({
        ...created,
        labels: ['bug'],
        updatedAt: body.updatedAt,
      })
    })

    it('creates any label names that do not exist yet when updating', async () => {
      const created = await createTask('Task')

      const res = await app.request(`/api/tasks/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels: ['new-label'] }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body).toEqual({
        ...created,
        labels: ['new-label'],
        updatedAt: body.updatedAt,
      })
    })

    it('clears all labels when given an empty array', async () => {
      const created = await createTask('Task', { labels: ['urgent'] })

      const res = await app.request(`/api/tasks/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels: [] }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse>(res)
      expect(body).toEqual({
        ...created,
        labels: [],
        updatedAt: body.updatedAt,
      })
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

    it('accepts the task number in place of the UUID', async () => {
      const created = await createTask('Task')

      const res = await app.request(`/api/tasks/${String(created.number)}`, {
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

  describe('sequential number', () => {
    it('assigns an increasing number to each created task', async () => {
      const a = await createTask('Task A')
      const b = await createTask('Task B')

      expect(b.number).toBeGreaterThan(a.number)
    })

    it('parentNumber is null for a root task in the list response', async () => {
      const parent = await createTask('Parent')

      const res = await app.request('/api/tasks')
      const body = await jsonBody<TaskListItemResponse[]>(res)

      const parentBody = body.find((t) => t.id === parent.id)
      assertDefined(parentBody)
      expect(parentBody.parentNumber).toBeNull()
    })

    it('parentNumber matches the parent task number in the list response', async () => {
      const parent = await createTask('Parent')
      const child = await createTask('Child', { parentId: parent.id })

      const res = await app.request('/api/tasks')
      const body = await jsonBody<TaskListItemResponse[]>(res)

      const childBody = body.find((t) => t.id === child.id)
      assertDefined(childBody)
      expect(childBody.parentNumber).toBe(parent.number)
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
