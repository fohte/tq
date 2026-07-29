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

async function createTaskFromGithub(url: string) {
  return app.request('/api/tasks/from-github', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

describe('POST /api/tasks/from-github', () => {
  it('creates a task from the issue title/body', async () => {
    await upsertToken('valid-token')
    mockIssueResponse()

    const res = await createTaskFromGithub(
      'https://github.com/fohte/tq/issues/42',
    )

    expect(res.status).toBe(201)
    const body = await jsonBody<{ created: boolean; task: TaskResponse }>(res)
    expect(body.created).toBe(true)
    expect(body.task.title).toBe('Bug: something broke')
    expect(body.task.description).toBe('Steps to reproduce...')
    expect(body.task.githubLink?.url).toBe(
      'https://github.com/fohte/tq/issues/42',
    )
  })

  it('returns the existing task instead of creating a duplicate', async () => {
    await upsertToken('valid-token')
    mockIssueResponse()
    const first = await createTaskFromGithub(
      'https://github.com/fohte/tq/issues/42',
    )
    const firstBody = await jsonBody<{ task: TaskResponse }>(first)

    const res = await createTaskFromGithub(
      'https://github.com/fohte/tq/issues/42',
    )

    expect(res.status).toBe(200)
    const body = await jsonBody<{ created: boolean; task: TaskResponse }>(res)
    expect(body.created).toBe(false)
    expect(body.task.id).toBe(firstBody.task.id)
  })

  it('returns 400 for a non-GitHub URL', async () => {
    const res = await createTaskFromGithub('https://example.com/not-github')

    expect(res.status).toBe(400)
  })

  it('returns 400 when GitHub is not connected', async () => {
    const res = await createTaskFromGithub(
      'https://github.com/fohte/tq/issues/42',
    )

    expect(res.status).toBe(400)
  })
})
