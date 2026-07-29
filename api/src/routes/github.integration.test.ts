import { afterEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import {
  mockGithubIssueResponse,
  upsertGithubToken,
} from '#integrations/github/testing'
import type { TaskResponse } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

afterEach(() => {
  vi.restoreAllMocks()
})

async function resolve(url: string) {
  return app.request('/api/github/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

describe('POST /api/github/resolve', () => {
  it('returns a preview when the issue is not linked to any task', async () => {
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()

    const res = await resolve('https://github.com/fohte/tq/issues/42')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      linked: false,
      preview: {
        owner: 'fohte',
        repo: 'tq',
        number: 42,
        kind: 'issue',
        url: 'https://github.com/fohte/tq/issues/42',
        title: 'Bug: something broke',
        body: 'Steps to reproduce...',
        state: 'open',
      },
    })
  })

  it('returns the existing task when already linked', async () => {
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    const created = await app.request('/api/tasks/from-github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })
    const createdBody = await jsonBody<{ task: TaskResponse }>(created)

    const res = await resolve('https://github.com/fohte/tq/issues/42')

    expect(res.status).toBe(200)
    const body = await jsonBody<{ linked: boolean; task: TaskResponse }>(res)
    expect(body).toEqual({ linked: true, task: createdBody.task })
  })

  it('returns 400 for a non-GitHub URL', async () => {
    const res = await resolve('https://example.com/not-github')

    expect(res.status).toBe(400)
  })

  it('returns 400 when GitHub is not connected', async () => {
    const res = await resolve('https://github.com/fohte/tq/issues/42')

    expect(res.status).toBe(400)
  })
})
