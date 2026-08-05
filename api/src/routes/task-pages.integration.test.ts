import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'

interface PageResponse {
  id: string
  taskId: string
  title: string
  content: string
  format: 'markdown' | 'html'
  sortOrder: number
  createdAt: string
  updatedAt: string
  author: { kind: 'human' | 'llm' | 'system'; agent: string | null } | null
}

function normalizePage(page: PageResponse) {
  return { ...page, id: 'ID', createdAt: 'DATE', updatedAt: 'DATE' }
}

describe('task pages API', () => {
  describe('GET /api/tasks/:taskId/pages', () => {
    it('returns empty list when no pages exist', async () => {
      const task = await createTask('Task')

      const res = await app.request(`/api/tasks/${task.id}/pages`)

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    })

    it('returns pages sorted by sortOrder', async () => {
      const task = await createTask('Task')
      await createPage(task.id, { title: 'Page B', sortOrder: 2 })
      await createPage(task.id, { title: 'Page A', sortOrder: 1 })
      await createPage(task.id, { title: 'Page C', sortOrder: 3 })

      const res = await app.request(`/api/tasks/${task.id}/pages`)

      expect(res.status).toBe(200)
      const body = await jsonBody<PageResponse[]>(res)
      expect(body).toHaveLength(3)
      expect(body.map((p) => p.title)).toEqual(['Page A', 'Page B', 'Page C'])
    })

    it('returns 404 for non-existent task', async () => {
      const res = await app.request(`/api/tasks/${TEST_UUID}/pages`)

      expect(res.status).toBe(404)
    })

    it('accepts the task number in place of the UUID', async () => {
      const task = await createTask('Task')
      const page = await createPage(task.id, { title: 'Page' })

      const res = await app.request(`/api/tasks/${String(task.number)}/pages`)

      expect(res.status).toBe(200)
      const body = await jsonBody<PageResponse[]>(res)
      expect(body.map(normalizePage)).toEqual([normalizePage(page)])
    })

    it('reports each page author independently', async () => {
      const task = await createTask('Task')
      const humanPage = await createPage(task.id, { title: 'Page A' })
      const llmPage = await createPage(
        task.id,
        { title: 'Page B' },
        { 'X-Author': 'llm:claude-opus-5' },
      )

      const res = await app.request(`/api/tasks/${task.id}/pages`)

      expect(res.status).toBe(200)
      expect(await jsonBody<PageResponse[]>(res)).toEqual([
        { ...humanPage, author: { kind: 'human', agent: null } },
        { ...llmPage, author: { kind: 'llm', agent: 'claude-opus-5' } },
      ])
    })
  })

  describe('POST /api/tasks/:taskId/pages', () => {
    it('creates a page with title only, defaulting format to markdown', async () => {
      const task = await createTask('Task')

      const res = await app.request(`/api/tasks/${task.id}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'My Page' }),
      })

      expect(res.status).toBe(201)
      const body = await jsonBody<PageResponse>(res)
      expect(normalizePage(body)).toEqual({
        id: 'ID',
        taskId: task.id,
        title: 'My Page',
        content: '',
        format: 'markdown',
        sortOrder: 0,
        createdAt: 'DATE',
        updatedAt: 'DATE',
        author: { kind: 'human', agent: null },
      })
    })

    it('creates a page with all fields', async () => {
      const task = await createTask('Task')

      const res = await app.request(`/api/tasks/${task.id}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Detailed Page',
          content: '# Hello\nWorld',
          sortOrder: 5,
        }),
      })

      expect(res.status).toBe(201)
      const body = await jsonBody<PageResponse>(res)
      expect(body.title).toBe('Detailed Page')
      expect(body.content).toBe('# Hello\nWorld')
      expect(body.sortOrder).toBe(5)
    })

    it('creates a page with format html', async () => {
      const task = await createTask('Task')

      const res = await app.request(`/api/tasks/${task.id}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'HTML Page', format: 'html' }),
      })

      expect(res.status).toBe(201)
      const body = await jsonBody<PageResponse>(res)
      expect(normalizePage(body)).toEqual({
        id: 'ID',
        taskId: task.id,
        title: 'HTML Page',
        content: '',
        format: 'html',
        sortOrder: 0,
        createdAt: 'DATE',
        updatedAt: 'DATE',
        author: { kind: 'human', agent: null },
      })
    })

    it('returns 400 for empty title', async () => {
      const task = await createTask('Task')

      const res = await app.request(`/api/tasks/${task.id}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '' }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 404 for non-existent task', async () => {
      const res = await app.request(`/api/tasks/${TEST_UUID}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Page' }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/tasks/:taskId/pages/:pageId', () => {
    it('updates page title', async () => {
      const task = await createTask('Task')
      const page = await createPage(task.id, { title: 'Original' })

      const res = await app.request(`/api/tasks/${task.id}/pages/${page.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated' }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<PageResponse>(res)
      expect(body.title).toBe('Updated')
    })

    it('updates page content', async () => {
      const task = await createTask('Task')
      const page = await createPage(task.id, { title: 'Page' })

      const res = await app.request(`/api/tasks/${task.id}/pages/${page.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'New content' }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<PageResponse>(res)
      expect(body.content).toBe('New content')
    })

    it('updates page sortOrder', async () => {
      const task = await createTask('Task')
      const page = await createPage(task.id, { title: 'Page', sortOrder: 1 })

      const res = await app.request(`/api/tasks/${task.id}/pages/${page.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: 10 }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<PageResponse>(res)
      expect(body.sortOrder).toBe(10)
    })

    it('updates page format from markdown to html', async () => {
      const task = await createTask('Task')
      const page = await createPage(task.id, { title: 'Page' })

      const res = await app.request(`/api/tasks/${task.id}/pages/${page.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'html' }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<PageResponse>(res)
      expect(normalizePage(body)).toEqual({
        id: 'ID',
        taskId: task.id,
        title: 'Page',
        content: '',
        format: 'html',
        sortOrder: 0,
        createdAt: 'DATE',
        updatedAt: 'DATE',
        author: { kind: 'human', agent: null },
      })
    })

    it('returns 404 for non-existent page', async () => {
      const task = await createTask('Task')

      const res = await app.request(
        `/api/tasks/${task.id}/pages/${TEST_UUID}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Updated' }),
        },
      )

      expect(res.status).toBe(404)
    })

    it('returns 404 when page belongs to different task', async () => {
      const task1 = await createTask('Task 1')
      const task2 = await createTask('Task 2')
      const page = await createPage(task1.id, { title: 'Page' })

      const res = await app.request(`/api/tasks/${task2.id}/pages/${page.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated' }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/tasks/:taskId/pages/:pageId', () => {
    it('deletes a page', async () => {
      const task = await createTask('Task')
      const page = await createPage(task.id, { title: 'Page' })

      const res = await app.request(`/api/tasks/${task.id}/pages/${page.id}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)

      // Verify page is gone
      const listRes = await app.request(`/api/tasks/${task.id}/pages`)
      const pages = await jsonBody<PageResponse[]>(listRes)
      expect(pages).toHaveLength(0)
    })

    it('returns 404 for non-existent page', async () => {
      const task = await createTask('Task')

      const res = await app.request(
        `/api/tasks/${task.id}/pages/${TEST_UUID}`,
        { method: 'DELETE' },
      )

      expect(res.status).toBe(404)
    })

    it('returns 404 when page belongs to different task', async () => {
      const task1 = await createTask('Task 1')
      const task2 = await createTask('Task 2')
      const page = await createPage(task1.id, { title: 'Page' })

      const res = await app.request(`/api/tasks/${task2.id}/pages/${page.id}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/tasks/:id includes pages', () => {
    it('returns pages in task detail response', async () => {
      const task = await createTask('Task')
      await createPage(task.id, { title: 'Page 1', sortOrder: 1 })
      await createPage(task.id, { title: 'Page 2', sortOrder: 2 })

      const res = await app.request(`/api/tasks/${task.id}`)

      expect(res.status).toBe(200)
      const body = await jsonBody<{ pages: PageResponse[] }>(res)
      expect(body.pages).toHaveLength(2)
      expect(body.pages.map((p) => p.title)).toEqual(['Page 1', 'Page 2'])
    })

    it('returns empty pages array when task has no pages', async () => {
      const task = await createTask('Task')

      const res = await app.request(`/api/tasks/${task.id}`)

      expect(res.status).toBe(200)
      const body = await jsonBody<{ pages: PageResponse[] }>(res)
      expect(body.pages).toEqual([])
    })
  })
})

async function createTask(title: string) {
  const res = await app.request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (res.status !== 201) {
    throw new Error(
      `Failed to create task: ${String(res.status)} ${await res.text()}`,
    )
  }
  return jsonBody<{ id: string; title: string; number: number }>(res)
}

async function createPage(
  taskId: string,
  opts: { title: string; content?: string; sortOrder?: number },
  headers: Record<string, string> = {},
) {
  const res = await app.request(`/api/tasks/${taskId}/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(opts),
  })
  if (res.status !== 201) {
    throw new Error(
      `Failed to create page: ${String(res.status)} ${await res.text()}`,
    )
  }
  return jsonBody<PageResponse>(res)
}
