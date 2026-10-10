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
  linkSync?: unknown
}

type PageListResponse = Omit<PageResponse, 'content'> & {
  preview: string | null
  contentTruncated: boolean
}

function normalizePage(page: PageResponse) {
  return { ...page, id: 'ID', createdAt: 'DATE', updatedAt: 'DATE' }
}

function normalizePageList(page: PageListResponse) {
  return {
    ...page,
    id: 'ID',
    createdAt: 'DATE',
    updatedAt: 'DATE',
    preview: page.preview,
    contentTruncated: page.contentTruncated,
  }
}

function pageListResponse<T>(status: number, pages: T[]) {
  return { status, pages }
}

function singlePageResponse<T>(status: number, page: T) {
  return { status, page }
}

function sortPagesById<T extends { id: string }>(pages: T[]) {
  return pages.toSorted((left, right) => left.id.localeCompare(right.id))
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
      const longMarkdown = 'a'.repeat(501)
      const boundaryMarkdown = 'b'.repeat(500)
      const longHtml = `<html>${'c'.repeat(501)}</html>`
      await createPage(task.id, {
        title: 'Markdown at the boundary',
        content: boundaryMarkdown,
        sortOrder: 2,
      })
      await createPage(task.id, {
        title: 'Long markdown',
        content: longMarkdown,
        sortOrder: 1,
      })
      await createPage(task.id, {
        title: 'Long HTML',
        content: longHtml,
        format: 'html',
        sortOrder: 3,
      })

      const res = await app.request(`/api/tasks/${task.id}/pages`)

      const body = await jsonBody<PageListResponse[]>(res)
      expect(pageListResponse(res.status, body.map(normalizePageList))).toEqual(
        {
          status: 200,
          pages: [
            {
              id: 'ID',
              taskId: task.id,
              title: 'Long markdown',
              format: 'markdown',
              sortOrder: 1,
              createdAt: 'DATE',
              updatedAt: 'DATE',
              author: { kind: 'human', agent: null },
              preview: 'a'.repeat(500),
              contentTruncated: true,
            },
            {
              id: 'ID',
              taskId: task.id,
              title: 'Markdown at the boundary',
              format: 'markdown',
              sortOrder: 2,
              createdAt: 'DATE',
              updatedAt: 'DATE',
              author: { kind: 'human', agent: null },
              preview: boundaryMarkdown,
              contentTruncated: false,
            },
            {
              id: 'ID',
              taskId: task.id,
              title: 'Long HTML',
              format: 'html',
              sortOrder: 3,
              createdAt: 'DATE',
              updatedAt: 'DATE',
              author: { kind: 'human', agent: null },
              preview: null,
              contentTruncated: true,
            },
          ],
        },
      )
    })

    it('returns 404 for non-existent task', async () => {
      const res = await app.request(`/api/tasks/${TEST_UUID}/pages`)

      expect(res.status).toBe(404)
    })

    it('accepts the task number in place of the UUID', async () => {
      const task = await createTask('Task')
      await createPage(task.id, { title: 'Page' })

      const res = await app.request(`/api/tasks/${String(task.number)}/pages`)

      const body = await jsonBody<PageListResponse[]>(res)
      expect(pageListResponse(res.status, body.map(normalizePageList))).toEqual(
        {
          status: 200,
          pages: [
            {
              id: 'ID',
              taskId: task.id,
              title: 'Page',
              format: 'markdown',
              sortOrder: 0,
              createdAt: 'DATE',
              updatedAt: 'DATE',
              author: { kind: 'human', agent: null },
              preview: '',
              contentTruncated: false,
            },
          ],
        },
      )
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

      const body = await jsonBody<PageListResponse[]>(res)
      expect(
        pageListResponse(
          res.status,
          sortPagesById(body).map(normalizePageList),
        ),
      ).toEqual({
        status: 200,
        pages: sortPagesById([
          {
            id: humanPage.id,
            taskId: task.id,
            title: 'Page A',
            format: 'markdown' as const,
            sortOrder: 0,
            createdAt: humanPage.createdAt,
            updatedAt: humanPage.updatedAt,
            author: { kind: 'human' as const, agent: null },
            preview: '',
            contentTruncated: false,
          },
          {
            id: llmPage.id,
            taskId: task.id,
            title: 'Page B',
            format: 'markdown' as const,
            sortOrder: 0,
            createdAt: llmPage.createdAt,
            updatedAt: llmPage.updatedAt,
            author: { kind: 'llm' as const, agent: 'claude-opus-5' },
            preview: '',
            contentTruncated: false,
          },
        ]).map(normalizePageList),
      })
    })
  })

  describe('GET /api/tasks/:taskId/pages/:pageId', () => {
    it('returns the full page content', async () => {
      const task = await createTask('Task')
      const content = 'Full page content.\n'.repeat(30)
      const page = await createPage(task.id, { title: 'Full page', content })

      const res = await app.request(`/api/tasks/${task.id}/pages/${page.id}`)

      const body = await jsonBody<PageResponse>(res)
      expect(singlePageResponse(res.status, normalizePage(body))).toEqual({
        status: 200,
        page: {
          id: 'ID',
          taskId: task.id,
          title: 'Full page',
          content,
          format: 'markdown',
          sortOrder: 0,
          createdAt: 'DATE',
          updatedAt: 'DATE',
          author: { kind: 'human', agent: null },
        },
      })
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
        linkSync: { outgoing: [], unresolvedRefs: [] },
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
        linkSync: { outgoing: [], unresolvedRefs: [] },
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

    it('returns 400 for markdown content over the markdown length limit', async () => {
      const task = await createTask('Task')

      const res = await app.request(`/api/tasks/${task.id}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Page', content: 'a'.repeat(100_001) }),
      })

      expect(res.status).toBe(400)
    })

    it('accepts html content over the markdown length limit', async () => {
      const task = await createTask('Task')
      const content = `<p>${'a'.repeat(150_000)}</p>`

      const res = await app.request(`/api/tasks/${task.id}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Page', format: 'html', content }),
      })

      expect(res.status).toBe(201)
      const body = await jsonBody<PageResponse>(res)
      expect(normalizePage(body)).toEqual({
        id: 'ID',
        taskId: task.id,
        title: 'Page',
        content,
        format: 'html',
        sortOrder: 0,
        createdAt: 'DATE',
        updatedAt: 'DATE',
        author: { kind: 'human', agent: null },
        linkSync: { outgoing: [], unresolvedRefs: [] },
      })
    })

    it('returns 400 for html content over the html length limit', async () => {
      const task = await createTask('Task')

      const res = await app.request(`/api/tasks/${task.id}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Page',
          format: 'html',
          content: 'a'.repeat(1_000_001),
        }),
      })

      expect(res.status).toBe(400)
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

    it('returns 400 when updating content over the markdown length limit', async () => {
      const task = await createTask('Task')
      const page = await createPage(task.id, { title: 'Page' })

      const res = await app.request(`/api/tasks/${task.id}/pages/${page.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'a'.repeat(100_001) }),
      })

      expect(res.status).toBe(400)
    })

    it('accepts content over the markdown length limit for an existing html page without resending format', async () => {
      const task = await createTask('Task')
      const page = await createPage(task.id, {
        title: 'Page',
        format: 'html',
      })
      const content = `<p>${'a'.repeat(150_000)}</p>`

      const res = await app.request(`/api/tasks/${task.id}/pages/${page.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<PageResponse>(res)
      expect(normalizePage(body)).toEqual({
        id: 'ID',
        taskId: task.id,
        title: 'Page',
        content,
        format: 'html',
        sortOrder: 0,
        createdAt: 'DATE',
        updatedAt: 'DATE',
        author: { kind: 'human', agent: null },
        linkSync: { outgoing: [], unresolvedRefs: [] },
      })
    })

    it('returns 400 when downgrading an oversized html page to markdown without resending content', async () => {
      const task = await createTask('Task')
      const page = await createPage(task.id, {
        title: 'Page',
        format: 'html',
        content: `<p>${'a'.repeat(150_000)}</p>`,
      })

      const res = await app.request(`/api/tasks/${task.id}/pages/${page.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'markdown' }),
      })

      expect(res.status).toBe(400)
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
      const pages = await jsonBody<PageListResponse[]>(listRes)
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
      const markdown = '## Page details\n'.padEnd(501, 'm')
      const html = `<main>${'h'.repeat(501)}</main>`
      await createPage(task.id, {
        title: 'Markdown page',
        content: markdown,
        sortOrder: 1,
      })
      await createPage(task.id, {
        title: 'HTML page',
        content: html,
        format: 'html',
        sortOrder: 2,
      })

      const res = await app.request(`/api/tasks/${task.id}`)

      const body = await jsonBody<{ pages: PageListResponse[] }>(res)
      expect(
        pageListResponse(res.status, body.pages.map(normalizePageList)),
      ).toEqual({
        status: 200,
        pages: [
          {
            id: 'ID',
            taskId: task.id,
            title: 'Markdown page',
            format: 'markdown',
            sortOrder: 1,
            createdAt: 'DATE',
            updatedAt: 'DATE',
            author: { kind: 'human', agent: null },
            preview: markdown.slice(0, 500),
            contentTruncated: true,
          },
          {
            id: 'ID',
            taskId: task.id,
            title: 'HTML page',
            format: 'html',
            sortOrder: 2,
            createdAt: 'DATE',
            updatedAt: 'DATE',
            author: { kind: 'human', agent: null },
            preview: null,
            contentTruncated: true,
          },
        ],
      })
    })

    it('returns empty pages array when task has no pages', async () => {
      const task = await createTask('Task')

      const res = await app.request(`/api/tasks/${task.id}`)

      const body = await jsonBody<{ pages: PageListResponse[] }>(res)
      expect(pageListResponse(res.status, body.pages)).toEqual({
        status: 200,
        pages: [],
      })
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
  opts: {
    title: string
    content?: string
    format?: 'markdown' | 'html'
    sortOrder?: number
  },
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
