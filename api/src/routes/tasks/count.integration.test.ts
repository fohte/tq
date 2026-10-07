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
  it('requires a context', async () => {
    const response = await app.request('/api/tasks/count?status=todo')

    expect(response.status).toEqual(400)
  })

  it('counts matching tasks without applying list pagination or ordering', async () => {
    await createTask('Work inbox task', {
      context: 'work',
      commitment: 'inbox',
    })
    const completedTask = await createTask('Completed work inbox task', {
      context: 'work',
      commitment: 'inbox',
    })
    await app.request(`/api/tasks/${completedTask.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    await createTask('Work active task', {
      context: 'work',
      commitment: 'active',
    })
    await createTask('Personal inbox task', {
      context: 'personal',
      commitment: 'inbox',
    })

    const response = await app.request(
      '/api/tasks/count?context=work&commitment=inbox&status=todo&limit=1&offset=1&sortBy=created',
    )

    expect(await normalizeCountResponse(response)).toEqual({
      status: 200,
      body: { count: 1 },
    })
  })
})
