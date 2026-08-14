import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { APP_DOMAIN } from '#env'
import { createTask } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

async function resolveUrl(url: string) {
  return app.request('/api/tasks/resolve-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

describe('POST /api/tasks/resolve-url', () => {
  it('resolves a numeric task URL', async () => {
    const task = await createTask('Target')

    const res = await resolveUrl(
      `https://${APP_DOMAIN}/tasks/${String(task.number)}`,
    )

    expect(res.status).toBe(200)
    expect(await jsonBody(res)).toEqual(task)
  })

  it('resolves a uuid task URL', async () => {
    const task = await createTask('Target')

    const res = await resolveUrl(`https://${APP_DOMAIN}/tasks/${task.id}`)

    expect(res.status).toBe(200)
    expect(await jsonBody(res)).toEqual(task)
  })

  it('returns 404 for a URL on a different domain', async () => {
    const task = await createTask('Target')

    const res = await resolveUrl(
      `https://example.com/tasks/${String(task.number)}`,
    )

    expect(res.status).toBe(404)
  })

  it('returns 404 for a different resource on the same domain', async () => {
    const res = await resolveUrl(`https://${APP_DOMAIN}/projects/some-id`)

    expect(res.status).toBe(404)
  })

  it('returns 404 for a task number that does not exist', async () => {
    const res = await resolveUrl(`https://${APP_DOMAIN}/tasks/999999999`)

    expect(res.status).toBe(404)
  })
})
