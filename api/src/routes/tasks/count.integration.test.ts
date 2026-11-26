import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { createTask } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

async function normalizeCountResponse(response: Response) {
  return {
    status: response.status,
    body: await jsonBody<{ count: number }>(response),
  }
}

describe('GET /api/tasks/count', () => {
  it('requires a context and status', async () => {
    const responses = await Promise.all([
      app.request('/api/tasks/count?status=todo'),
      app.request('/api/tasks/count?context=work'),
    ])

    expect(responses.map((response) => response.status)).toEqual([400, 400])
  })

  it("counts tasks across all contexts and statuses when 'all' is explicit", async () => {
    const completedTask = await createTask('Completed task', {
      context: 'work',
    })
    await app.request(`/api/tasks/${completedTask.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    await createTask('Personal task', { context: 'personal' })

    const response = await app.request(
      '/api/tasks/count?context=all&status=all',
    )

    expect(await normalizeCountResponse(response)).toEqual({
      status: 200,
      body: { count: 2 },
    })
  })

  it('ignores the view parameter', async () => {
    await createTask('Task to count', { context: 'work' })

    const response = await app.request(
      '/api/tasks/count?context=all&status=all&view=row',
    )

    expect(await normalizeCountResponse(response)).toEqual({
      status: 200,
      body: { count: 1 },
    })
  })

  it('counts matching tasks without applying list pagination or ordering', async () => {
    await createTask('Work inbox task', {
      context: 'work',
    })
    const completedTask = await createTask('Completed work inbox task', {
      context: 'work',
    })
    await app.request(`/api/tasks/${completedTask.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    await createTask('Work active task', {
      context: 'work',
      priority: 0,
    })
    await createTask('Personal inbox task', {
      context: 'personal',
    })

    const response = await app.request(
      '/api/tasks/count?context=work&priority=none&status=todo&limit=1&offset=1&sortBy=created',
    )

    expect(await normalizeCountResponse(response)).toEqual({
      status: 200,
      body: { count: 1 },
    })
  })

  it('filters by priority values', async () => {
    await createTask('Inbox task')
    await createTask('Deferred task', { priority: -1 })
    await createTask('Routine task', { priority: 0 })
    await createTask('Urgent task', { priority: 2 })

    const responses = await Promise.all([
      app.request('/api/tasks/count?context=all&status=all&priority=none'),
      app.request('/api/tasks/count?context=all&status=all&priority=-1'),
      app.request('/api/tasks/count?context=all&status=all&priority=2'),
    ])

    expect(await Promise.all(responses.map(normalizeCountResponse))).toEqual([
      { status: 200, body: { count: 1 } },
      { status: 200, body: { count: 1 } },
      { status: 200, body: { count: 1 } },
    ])
  })
})
