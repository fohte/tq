import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { createPage, createTask } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

type PageSearchResult = {
  page: {
    id: string
    taskId: string
    title: string
    format: 'markdown' | 'html'
    sortOrder: number
    createdAt: string
    updatedAt: string
  }
  task: {
    id: string
    number: number
    title: string
    context: 'work' | 'personal'
  }
  match: { term: string; excerpt: string }
}

function normalizeResult(result: PageSearchResult): PageSearchResult {
  return {
    ...result,
    page: {
      ...result.page,
      id: 'PAGE_ID',
      createdAt: 'DATE',
      updatedAt: 'DATE',
    },
  }
}

function normalizeResponse(
  status: number,
  body: PageSearchResult[],
): { status: number; body: PageSearchResult[] } {
  return {
    status,
    body: body
      .map(normalizeResult)
      .sort((a, b) => a.task.number - b.task.number),
  }
}

function expectedResult(
  task: Awaited<ReturnType<typeof createTask>>,
  title: string,
  term: string,
  excerpt: string,
): PageSearchResult {
  return {
    page: {
      id: 'PAGE_ID',
      taskId: task.id,
      title,
      format: 'markdown',
      sortOrder: 0,
      createdAt: 'DATE',
      updatedAt: 'DATE',
    },
    task: {
      id: task.id,
      number: task.number,
      title: task.title,
      context: task.context,
    },
    match: { term, excerpt },
  }
}

describe('GET /api/pages/search', () => {
  it('returns matching pages across tasks with the matched excerpt', async () => {
    const workTask = await createTask('Work notes', { context: 'work' })
    const personalTask = await createTask('Personal notes', {
      context: 'personal',
    })
    await createPage(workTask.id, 'Work page', 'Start: Needle in this page.')
    await createPage(personalTask.id, 'Personal page', 'Needle reference.')

    const res = await app.request('/api/pages/search?q=needle')
    const body = await jsonBody<PageSearchResult[]>(res)

    expect(normalizeResponse(res.status, body)).toEqual({
      status: 200,
      body: [
        expectedResult(
          workTask,
          'Work page',
          'needle',
          'Start: Needle in this page.',
        ),
        expectedResult(
          personalTask,
          'Personal page',
          'needle',
          'Needle reference.',
        ),
      ].sort((a, b) => a.task.number - b.task.number),
    })
  })

  it('filters matching pages by the parent task context', async () => {
    const workTask = await createTask('Work notes', { context: 'work' })
    const personalTask = await createTask('Personal notes', {
      context: 'personal',
    })
    await createPage(workTask.id, 'Work page', 'Needle reference.')
    await createPage(personalTask.id, 'Personal page', 'Needle reference.')

    const res = await app.request('/api/pages/search?q=needle&context=work')
    const body = await jsonBody<PageSearchResult[]>(res)

    expect(normalizeResponse(res.status, body)).toEqual({
      status: 200,
      body: [
        expectedResult(workTask, 'Work page', 'needle', 'Needle reference.'),
      ],
    })
  })

  it('requires every whitespace-separated term to match the page body', async () => {
    const task = await createTask('Search notes')
    await createPage(task.id, 'Complete match', 'Alpha and beta appear here.')
    await createPage(
      task.id,
      'Partial match',
      'Alpha appears without the other word.',
    )

    const res = await app.request('/api/pages/search?q=alpha%20beta')
    const body = await jsonBody<PageSearchResult[]>(res)

    expect(normalizeResponse(res.status, body)).toEqual({
      status: 200,
      body: [
        expectedResult(
          task,
          'Complete match',
          'alpha',
          'Alpha and beta appear here.',
        ),
      ],
    })
  })
})
