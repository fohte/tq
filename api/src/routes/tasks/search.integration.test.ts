import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { createComment, createPage, createTask } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

interface PageSearchResult {
  source: 'page' | 'comment' | 'task'
  taskNumber: number
  taskTitle: string
  pageId: string | null
  pageTitle: string | null
  snippet: string
  matchCount: number
  updatedAt: string
}

function normalizePageSearchResult(result: PageSearchResult) {
  return { ...result, updatedAt: 'DATE' }
}

function makePageSearchResponse(status: number, results: PageSearchResult[]) {
  return { status, body: { results } }
}

describe('tasks search API', () => {
  describe('GET /api/tasks/search/suggest', () => {
    it('returns suggestions for prefix', async () => {
      const res = await app.request('/api/tasks/search/suggest?prefix=is:')

      expect(res.status).toBe(200)
      const body =
        await jsonBody<
          Array<{ value: string; display: string; category: string }>
        >(res)
      expect(body).toEqual([
        { value: 'is:todo', display: 'Todo', category: 'is' },
        { value: 'is:completed', display: 'Completed', category: 'is' },
      ])
    })

    it('returns suggestions for reason values', async () => {
      const res = await app.request('/api/tasks/search/suggest?prefix=reason:')

      expect(res.status).toBe(200)
      const body =
        await jsonBody<
          Array<{ value: string; display: string; category: string }>
        >(res)
      expect(body).toEqual([
        { value: 'reason:completed', display: 'Completed', category: 'reason' },
        {
          value: 'reason:not_planned',
          display: 'Not planned',
          category: 'reason',
        },
        { value: 'reason:duplicate', display: 'Duplicate', category: 'reason' },
      ])
    })

    it('returns a key-only suggestion for a dynamic token', async () => {
      const res = await app.request('/api/tasks/search/suggest?prefix=label:')

      expect(res.status).toBe(200)
      const body =
        await jsonBody<
          Array<{ value: string; display: string; category: string }>
        >(res)
      expect(body).toEqual([
        { value: 'label:', display: 'Label', category: 'label' },
      ])
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

    it('returns tasks in creation order, limited to the requested count', async () => {
      const task1 = await createTask('Task 1')
      const task2 = await createTask('Task 2')
      await createTask('Task 3')

      const res = await app.request('/api/tasks/mentions?limit=2')

      expect(res.status).toBe(200)
      const body = await jsonBody<MentionSummary[]>(res)
      expect(body).toEqual([toMentionSummary(task1), toMentionSummary(task2)])
    })
  })

  describe('GET /api/tasks/search/pages', () => {
    it('returns matching pages, comments, and tasks with snippets', async () => {
      const task = await createTask('Archive', {
        description: 'beacon signal beacon signal',
      })
      const pageContent = `${'x'.repeat(70)}beacon signal beacon signal${'y'.repeat(100)}`
      const page = await createPage(task.id, 'Reference', pageContent)
      await createComment(task.id, 'beacon signal beacon signal')

      const res = await app.request(
        `/api/tasks/search/pages?q=${encodeURIComponent('beacon signal')}`,
      )

      const body = await jsonBody<{ results: PageSearchResult[] }>(res)
      expect(
        makePageSearchResponse(
          res.status,
          body.results
            .map(normalizePageSearchResult)
            .sort((left, right) => left.source.localeCompare(right.source)),
        ),
      ).toEqual({
        status: 200,
        body: {
          results: [
            {
              source: 'comment',
              taskNumber: task.number,
              taskTitle: 'Archive',
              pageId: null,
              pageTitle: null,
              snippet: 'beacon signal beacon signal',
              matchCount: 4,
              updatedAt: 'DATE',
            },
            {
              source: 'page',
              taskNumber: task.number,
              taskTitle: 'Archive',
              pageId: page.id,
              pageTitle: 'Reference',
              snippet: `${'x'.repeat(60)}beacon signal beacon signal${'y'.repeat(73)}`,
              matchCount: 4,
              updatedAt: 'DATE',
            },
            {
              source: 'task',
              taskNumber: task.number,
              taskTitle: 'Archive',
              pageId: null,
              pageTitle: null,
              snippet: 'Archive beacon signal beacon signal',
              matchCount: 4,
              updatedAt: 'DATE',
            },
          ],
        },
      })
    })

    it('filters results by source when requested', async () => {
      const task = await createTask('Notebook task', {
        description: 'page-only content',
      })
      const page = await createPage(
        task.id,
        'Notebook page',
        'page-only content',
      )
      await createComment(task.id, 'page-only content')

      const res = await app.request(
        `/api/tasks/search/pages?q=${encodeURIComponent('page-only content')}&source=page`,
      )
      const body = await jsonBody<{ results: PageSearchResult[] }>(res)

      const getOutput = () => ({
        status: res.status,
        results: body.results.map(normalizePageSearchResult),
      })
      expect(getOutput()).toEqual({
        status: 200,
        results: [
          {
            source: 'page',
            taskNumber: task.number,
            taskTitle: 'Notebook task',
            pageId: page.id,
            pageTitle: 'Notebook page',
            snippet: 'page-only content',
            matchCount: 2,
            updatedAt: 'DATE',
          },
        ],
      })
    })

    it('requires every search word to match within one source', async () => {
      const task = await createTask('Unrelated task')
      await createPage(task.id, 'Beacon notes', 'beacon appears here')
      await createPage(task.id, 'Signal notes', 'signal appears here')
      await createComment(task.id, 'beacon appears in this comment')

      const res = await app.request(
        `/api/tasks/search/pages?q=${encodeURIComponent('beacon signal')}`,
      )

      expect(
        makePageSearchResponse(
          res.status,
          (await jsonBody<{ results: PageSearchResult[] }>(res)).results,
        ),
      ).toEqual({ status: 200, body: { results: [] } })
    })

    it('treats LIKE wildcard characters as literal search text', async () => {
      const task = await createTask('Unrelated task')
      const pageContent = '100%_complete \\path'
      const page = await createPage(task.id, 'Symbols', pageContent)
      await createPage(task.id, 'Wildcard decoy', '100XXcomplete \\path')
      await createPage(task.id, 'Escape decoy', '100%_complete path')

      const res = await app.request(
        `/api/tasks/search/pages?q=${encodeURIComponent(pageContent)}`,
      )
      const body = await jsonBody<{ results: PageSearchResult[] }>(res)

      expect(
        makePageSearchResponse(
          res.status,
          body.results.map(normalizePageSearchResult),
        ),
      ).toEqual({
        status: 200,
        body: {
          results: [
            {
              source: 'page',
              taskNumber: task.number,
              taskTitle: 'Unrelated task',
              pageId: page.id,
              pageTitle: 'Symbols',
              snippet: pageContent,
              matchCount: 2,
              updatedAt: 'DATE',
            },
          ],
        },
      })
    })

    it('returns no results when q contains no free-text terms', async () => {
      const task = await createTask('Task with pages')
      await createPage(task.id, 'Page', 'content')

      const res = await app.request('/api/tasks/search/pages?q=has%3Apages')

      expect(
        makePageSearchResponse(
          res.status,
          (await jsonBody<{ results: PageSearchResult[] }>(res)).results,
        ),
      ).toEqual({ status: 200, body: { results: [] } })
    })

    it('applies the result limit after sorting matches across sources', async () => {
      const task = await createTask('Unrelated task')
      await createPage(task.id, 'First page', 'beacon signal')
      await createPage(task.id, 'Second page', 'beacon signal')
      await createComment(task.id, 'beacon signal')

      const res = await app.request(
        `/api/tasks/search/pages?q=${encodeURIComponent('beacon signal')}&limit=1`,
      )
      const body = await jsonBody<{ results: PageSearchResult[] }>(res)

      expect(
        makePageSearchResponse(
          res.status,
          body.results.map(normalizePageSearchResult),
        ),
      ).toEqual({
        status: 200,
        body: {
          results: [
            {
              source: 'comment',
              taskNumber: task.number,
              taskTitle: 'Unrelated task',
              pageId: null,
              pageTitle: null,
              snippet: 'beacon signal',
              matchCount: 2,
              updatedAt: 'DATE',
            },
          ],
        },
      })
    })
  })
})
