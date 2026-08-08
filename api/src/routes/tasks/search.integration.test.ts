import { describe, expect, it } from 'vitest'

import { app } from '#app'
import {
  createComment,
  createLabel,
  createPage,
  createTask,
  TaskListItemResponse,
  withoutRecurrenceRule,
} from '#routes/tasks/testing'
import { assertDefined, jsonBody, setupTestDb } from '#testing'

setupTestDb()

describe('tasks search API', () => {
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
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].title).toBe('Without estimate')
    })

    it('searches free text in title', async () => {
      await createTask('Deploy to production')
      await createTask('Buy groceries')

      const res = await app.request(
        '/api/tasks/search?q=' + encodeURIComponent('deploy'),
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].title).toBe('Deploy to production')
    })

    it('searches free text in description', async () => {
      await createTask('Task A', { description: 'fix the login bug' })
      await createTask('Task B', { description: 'add new feature' })

      const res = await app.request(
        '/api/tasks/search?q=' + encodeURIComponent('login'),
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].title).toBe('Task A')
    })

    it('searches free text in task page content', async () => {
      const task = await createTask('Task with page')
      await createTask('Task without page')
      await createPage(task.id, 'Notes', 'important meeting notes')

      const res = await app.request(
        '/api/tasks/search?q=' + encodeURIComponent('meeting'),
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].title).toBe('Task with page')
    })

    it('filters by is: prefix in q parameter', async () => {
      const task = await createTask('Completed task')
      await createTask('Todo task')
      await app.request(`/api/tasks/${task.id}/complete`, { method: 'POST' })

      const res = await app.request(
        '/api/tasks/search?q=' + encodeURIComponent('is:completed'),
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].title).toBe('Completed task')
    })

    it('filters by label: prefix in q parameter', async () => {
      await createLabel('dev')
      const task = await createTask('Dev task', { labels: ['dev'] })
      await createTask('Other task')

      const res = await app.request(
        '/api/tasks/search?q=' + encodeURIComponent('label:dev'),
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toEqual([
        { ...withoutRecurrenceRule(task), parentNumber: null },
      ])
    })

    it('filters by context: prefix in q parameter', async () => {
      await createTask('Work task', { context: 'work' })
      await createTask('Personal task')

      const res = await app.request(
        '/api/tasks/search?q=' + encodeURIComponent('context:work'),
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
        '/api/tasks/search?q=' + encodeURIComponent('has:pages'),
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
        '/api/tasks/search?q=' + encodeURIComponent('has:comments'),
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
        '/api/tasks/search?q=' + encodeURIComponent(`parent:${parent.id}`),
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].title).toBe('Child')
    })

    it('combines free text with prefix filters', async () => {
      await createTask('Deploy app', { context: 'work' })
      await createTask('Deploy docs')
      await createTask('Build app', { context: 'work' })

      const res = await app.request(
        '/api/tasks/search?q=' + encodeURIComponent('deploy context:work'),
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].title).toBe('Deploy app')
    })

    it('returns all tasks when q is empty', async () => {
      await createTask('Task A')
      await createTask('Task B')

      const res = await app.request('/api/tasks/search')

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(2)
    })

    it('respects limit and offset', async () => {
      await createTask('Task 1')
      await createTask('Task 2')
      await createTask('Task 3')

      const res = await app.request('/api/tasks/search?limit=1&offset=1')

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toHaveLength(1)
    })

    it('includes the parent task number for a task with a parent', async () => {
      const parent = await createTask('Parent task')
      const child = await createTask('Child task', { parentId: parent.id })

      const res = await app.request(
        '/api/tasks/search?q=' + encodeURIComponent('Child task'),
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toEqual([
        { ...withoutRecurrenceRule(child), parentNumber: parent.number },
      ])
    })

    it('returns a null parentNumber for a root task', async () => {
      const task = await createTask('Root task')

      const res = await app.request(
        '/api/tasks/search?q=' + encodeURIComponent('Root task'),
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskListItemResponse[]>(res)
      expect(body).toEqual([
        { ...withoutRecurrenceRule(task), parentNumber: null },
      ])
    })
  })

  describe('GET /api/tasks/search/suggest', () => {
    it('returns suggestions for prefix', async () => {
      const res = await app.request('/api/tasks/search/suggest?prefix=is:')

      expect(res.status).toBe(200)
      const body =
        await jsonBody<
          Array<{ value: string; display: string; category: string }>
        >(res)
      expect(body.length).toBeGreaterThan(0)
      expect(body.every((s) => s.category === 'is')).toBe(true)
    })
  })

  describe('GET /api/tasks/mentions', () => {
    type MentionSummary = {
      id: string
      number: number
      title: string
      status: string
    }

    function toMentionSummary(
      task: Awaited<ReturnType<typeof createTask>>,
    ): MentionSummary {
      return {
        id: task.id,
        number: task.number,
        title: task.title,
        status: task.status,
      }
    }

    it('matches an exact numeric query against that task number', async () => {
      const task1 = await createTask('First task')
      await createTask('Second task')

      const res = await app.request(
        `/api/tasks/mentions?q=${encodeURIComponent(String(task1.number))}`,
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<MentionSummary[]>(res)
      expect(body).toEqual([toMentionSummary(task1)])
    })

    it('matches tasks whose number starts with a shorter numeric query', async () => {
      // Force the sequence to a 2+ digit number so `prefix` below is
      // genuinely shorter than the full number - this guards against the
      // endpoint regressing from a LIKE-based prefix match to an
      // exact-match comparison.
      const created: Array<Awaited<ReturnType<typeof createTask>>> = []
      let target: Awaited<ReturnType<typeof createTask>>
      do {
        target = await createTask('Number probe')
        created.push(target)
      } while (target.number < 10)

      const prefix = String(target.number).slice(0, -1)
      const expected = created
        .filter((t) => String(t.number).startsWith(prefix))
        .map(toMentionSummary)
        .sort((a, b) => a.number - b.number)

      const res = await app.request(
        `/api/tasks/mentions?q=${encodeURIComponent(prefix)}`,
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<MentionSummary[]>(res)
      expect([...body].sort((a, b) => a.number - b.number)).toEqual(expected)
    })

    it('matches by title substring when q is not numeric', async () => {
      const deploy = await createTask('Deploy to production')
      await createTask('Buy groceries')

      const res = await app.request(
        '/api/tasks/mentions?q=' + encodeURIComponent('deploy'),
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<MentionSummary[]>(res)
      expect(body).toEqual([toMentionSummary(deploy)])
    })

    it('returns tasks ordered by number, limited to the requested count', async () => {
      const task1 = await createTask('Task 1')
      const task2 = await createTask('Task 2')
      await createTask('Task 3')

      const res = await app.request('/api/tasks/mentions?limit=2')

      expect(res.status).toBe(200)
      const body = await jsonBody<MentionSummary[]>(res)
      expect(body).toEqual([toMentionSummary(task1), toMentionSummary(task2)])
    })
  })
})
