/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { app } from '@api/app'
import {
  createComment,
  createLabel,
  createPage,
  createTask,
  TaskResponse,
} from '@api/routes/tasks/testing'
import { setupTestDb } from '@api/testing'
import { describe, expect, it } from 'vitest'

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
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(1)
      expect(body[0]!.title).toBe('Without estimate')
    })

    it('searches free text in title', async () => {
      await createTask('Deploy to production')
      await createTask('Buy groceries')

      const res = await app.request(
        '/api/tasks/search?q=' + encodeURIComponent('deploy'),
      )

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(1)
      expect(body[0]!.title).toBe('Deploy to production')
    })

    it('searches free text in description', async () => {
      await createTask('Task A', { description: 'fix the login bug' })
      await createTask('Task B', { description: 'add new feature' })

      const res = await app.request(
        '/api/tasks/search?q=' + encodeURIComponent('login'),
      )

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(1)
      expect(body[0]!.title).toBe('Task A')
    })

    it('searches free text in task page content', async () => {
      const task = await createTask('Task with page')
      await createTask('Task without page')
      await createPage(task.id, 'Notes', 'important meeting notes')

      const res = await app.request(
        '/api/tasks/search?q=' + encodeURIComponent('meeting'),
      )

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(1)
      expect(body[0]!.title).toBe('Task with page')
    })

    it('filters by is: prefix in q parameter', async () => {
      const task = await createTask('Completed task')
      await createTask('Todo task')
      await app.request(`/api/tasks/${task.id}/complete`, { method: 'POST' })

      const res = await app.request(
        '/api/tasks/search?q=' + encodeURIComponent('is:completed'),
      )

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(1)
      expect(body[0]!.title).toBe('Completed task')
    })

    it('filters by label: prefix in q parameter', async () => {
      await createLabel('dev')
      await createTask('Dev task', { labels: ['dev'] })
      await createTask('Other task')

      const res = await app.request(
        '/api/tasks/search?q=' + encodeURIComponent('label:dev'),
      )

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(1)
      expect(body[0]!.title).toBe('Dev task')
    })

    it('filters by context: prefix in q parameter', async () => {
      await createTask('Work task', { context: 'work' })
      await createTask('Personal task')

      const res = await app.request(
        '/api/tasks/search?q=' + encodeURIComponent('context:work'),
      )

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(1)
      expect(body[0]!.title).toBe('Work task')
    })

    it('filters by has:pages prefix in q parameter', async () => {
      const task = await createTask('Has pages')
      await createTask('No pages')
      await createPage(task.id, 'Page', 'content')

      const res = await app.request(
        '/api/tasks/search?q=' + encodeURIComponent('has:pages'),
      )

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(1)
      expect(body[0]!.title).toBe('Has pages')
    })

    it('filters by has:comments prefix in q parameter', async () => {
      const task = await createTask('Has comments')
      await createTask('No comments')
      await createComment(task.id, 'A comment')

      const res = await app.request(
        '/api/tasks/search?q=' + encodeURIComponent('has:comments'),
      )

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(1)
      expect(body[0]!.title).toBe('Has comments')
    })

    it('filters by parent: prefix in q parameter', async () => {
      const parent = await createTask('Parent')
      await createTask('Child', { parentId: parent.id })
      await createTask('Orphan')

      const res = await app.request(
        '/api/tasks/search?q=' + encodeURIComponent(`parent:${parent.id}`),
      )

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(1)
      expect(body[0]!.title).toBe('Child')
    })

    it('combines free text with prefix filters', async () => {
      await createTask('Deploy app', { context: 'work' })
      await createTask('Deploy docs')
      await createTask('Build app', { context: 'work' })

      const res = await app.request(
        '/api/tasks/search?q=' + encodeURIComponent('deploy context:work'),
      )

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(1)
      expect(body[0]!.title).toBe('Deploy app')
    })

    it('returns all tasks when q is empty', async () => {
      await createTask('Task A')
      await createTask('Task B')

      const res = await app.request('/api/tasks/search')

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(2)
    })

    it('respects limit and offset', async () => {
      await createTask('Task 1')
      await createTask('Task 2')
      await createTask('Task 3')

      const res = await app.request('/api/tasks/search?limit=1&offset=1')

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(1)
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
})
