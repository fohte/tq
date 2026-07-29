import { afterEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { oauthTokens } from '#db/schema'
import type { TaskResponse } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

afterEach(() => {
  vi.restoreAllMocks()
})

async function upsertToken(accessToken: string) {
  await db
    .insert(oauthTokens)
    .values({ provider: 'github', accessToken })
    .onConflictDoUpdate({
      target: oauthTokens.provider,
      set: { accessToken, updatedAt: new Date() },
    })
}

function mockIssueResponse(overrides: Partial<Record<string, unknown>> = {}) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        title: 'Bug: something broke',
        body: 'Steps to reproduce...',
        state: 'open',
        html_url: 'https://github.com/fohte/tq/issues/42',
        ...overrides,
      }),
      { status: 200 },
    ),
  )
}

async function resolve(url: string) {
  return app.request('/api/github/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

describe('POST /api/github/resolve', () => {
  it('returns a preview when the issue is not linked to any task', async () => {
    await upsertToken('valid-token')
    mockIssueResponse()

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
    await upsertToken('valid-token')
    mockIssueResponse()
    await app.request('/api/tasks/from-github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })

    const res = await resolve('https://github.com/fohte/tq/issues/42')

    expect(res.status).toBe(200)
    const body = await jsonBody<{ linked: boolean; task: TaskResponse }>(res)
    expect(body.linked).toBe(true)
    expect(body.task.title).toBe('Bug: something broke')
    expect(body.task.githubLink?.url).toBe(
      'https://github.com/fohte/tq/issues/42',
    )
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
